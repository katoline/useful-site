import { afterEach, describe, expect, it, vi } from "vitest";
import { MIME_TYPE } from "../../../domain/format";
import { toPreviewBlob } from "./preview";

afterEach(() => vi.unstubAllGlobals());

describe("toPreviewBlob", () => {
  it.each(["png", "jpeg", "webp", "gif"] as const)(
    "%s は入力の MIME によらず画像の MIME で返す",
    async (format) => {
      const source = new Blob(["image bytes"], { type: "text/html" });
      const preview = await toPreviewBlob(source, format);
      expect(preview?.type).toBe(MIME_TYPE[format]);
      expect(await preview?.text()).toBe("image bytes");
      expect(preview).not.toBe(source);
    },
  );

  it("形式不明なら SVG の MIME でも表示しない", async () => {
    expect(await toPreviewBlob(new Blob(["unknown"], { type: "image/svg+xml" }), null)).toBeNull();
  });

  it("縮小できなければ判定した MIME の元画像を返す", async () => {
    vi.stubGlobal("createImageBitmap", undefined);
    const preview = await toPreviewBlob(
      new Blob(["image bytes"], { type: "text/html" }),
      "png",
      200,
    );
    expect(preview?.type).toBe("image/png");
    expect(await preview?.text()).toBe("image bytes");
  });

  it("縮小する際の入力は判定した MIME、出力は PNG にそろえる", async () => {
    const bytes = new Uint8Array(24);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    bytes.set([0x49, 0x48, 0x44, 0x52], 12);
    const view = new DataView(bytes.buffer);
    view.setUint32(16, 1000);
    view.setUint32(20, 500);
    const close = vi.fn();
    const createImageBitmap = vi.fn(async (_blob: Blob) => ({ width: 200, height: 100, close }));
    vi.stubGlobal("createImageBitmap", createImageBitmap);
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: vi.fn() }),
      toBlob: (callback: (blob: Blob) => void, mime: string) => {
        expect(mime).toBe("image/png");
        callback(new Blob(["thumbnail"], { type: "application/octet-stream" }));
      },
    };
    vi.stubGlobal("document", { createElement: () => canvas });
    const preview = await toPreviewBlob(new Blob([bytes], { type: "text/html" }), "png", 200);
    expect(createImageBitmap.mock.calls[0]?.[0]).toMatchObject({ type: "image/png" });
    expect(preview?.type).toBe("image/png");
    expect(await preview?.text()).toBe("thumbnail");
    expect(close).toHaveBeenCalledOnce();
  });
});
