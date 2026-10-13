// @vitest-environment happy-dom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CompareDialog } from "~/apps/image-adjust/components/tools/CompareDialog";
import { loadSource } from "~/apps/image-adjust/components/tools/engine";
import type { ToolItem, ToolOutput } from "~/apps/image-adjust/components/tools/types";

vi.mock("~/apps/image-adjust/components/tools/engine", () => ({ loadSource: vi.fn() }));
vi.mock("~/apps/image-adjust/components/tools/preview", () => ({
  toPreviewBlob: async (blob: Blob) => blob,
}));

function deferred() {
  let resolve!: (blob: Blob) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<Blob>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

const output: ToolOutput = {
  name: "after.webp",
  path: "after.webp",
  format: "webp",
  blob: new Blob(["after"], { type: "image/webp" }),
  width: 160,
  height: 120,
  quality: 80,
  variantWidth: null,
};

function zipItem(id = "one"): ToolItem {
  return {
    id,
    name: `${id}.png`,
    path: `${id}.png`,
    source: null,
    origin: { zip: new File([], "source.zip"), entryName: `${id}.png` },
    size: 100,
    type: "image/png",
    status: "done",
    result: {
      inputFormat: "png",
      inputBytes: 100,
      inputWidth: 160,
      inputHeight: 120,
      outputs: [output],
      warnings: [],
    },
  };
}

describe("比較ダイアログの処理前画像", () => {
  const blobs = new Map<string, Blob | MediaSource>();
  const createUrl = vi.fn((blob: Blob | MediaSource) => {
    const url = `blob:preview-${blobs.size}`;
    blobs.set(url, blob);
    return url;
  });
  const revokeUrl = vi.fn();

  beforeEach(() => {
    vi.mocked(loadSource).mockReset();
    blobs.clear();
    createUrl.mockClear();
    revokeUrl.mockClear();
    vi.spyOn(URL, "createObjectURL").mockImplementation(createUrl);
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(revokeUrl);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("開いている間だけ ZIP から読み直し、閉じると URL を解放して次回は再読み込みする", async () => {
    const item = zipItem();
    const source = new Blob(["before"], { type: "image/png" });
    vi.mocked(loadSource).mockResolvedValue(source);
    const props = { item, outputs: [output], onOpenChange: vi.fn() };
    const { rerender } = render(<CompareDialog {...props} open={false} />);
    expect(loadSource).not.toHaveBeenCalled();

    rerender(<CompareDialog {...props} open />);
    const before = await screen.findByRole("img", { name: /^処理前$/ });
    const url = before.getAttribute("src") as string;
    expect(blobs.get(url)).toBe(source);
    expect(item.source).toBeNull();
    rerender(<CompareDialog {...props} open={false} />);
    await waitFor(() => expect(revokeUrl).toHaveBeenCalledWith(url));

    rerender(<CompareDialog {...props} open />);
    await screen.findByRole("img", { name: /^処理前$/ });
    expect(loadSource).toHaveBeenCalledTimes(2);
  });

  it("閉じた後に完了した読み込みを次回の比較へ持ち越さない", async () => {
    const oldRead = deferred();
    const newRead = deferred();
    vi.mocked(loadSource).mockReturnValueOnce(oldRead.promise).mockReturnValueOnce(newRead.promise);
    const props = { item: zipItem(), outputs: [output], onOpenChange: vi.fn() };
    const { rerender } = render(<CompareDialog {...props} open />);
    rerender(<CompareDialog {...props} open={false} />);
    rerender(<CompareDialog {...props} open />);
    const obsolete = new Blob(["old"]);
    await act(async () => oldRead.resolve(obsolete));
    expect(screen.queryByRole("img", { name: /^処理前$/ })).toBeNull();
    expect(createUrl).not.toHaveBeenCalledWith(obsolete);

    const current = new Blob(["new"]);
    await act(async () => newRead.resolve(current));
    const before = await screen.findByRole("img", { name: /^処理前$/ });
    expect(blobs.get(before.getAttribute("src") as string)).toBe(current);
  });

  it("別の項目へ切り替えた後に完了した古い読み込みを反映しない", async () => {
    const oldRead = deferred();
    const newRead = deferred();
    vi.mocked(loadSource).mockReturnValueOnce(oldRead.promise).mockReturnValueOnce(newRead.promise);
    const props = { outputs: [output], onOpenChange: vi.fn(), open: true };
    const { rerender } = render(<CompareDialog {...props} item={zipItem("old")} />);
    rerender(<CompareDialog {...props} item={zipItem("new")} />);
    const current = new Blob(["new"]);
    await act(async () => newRead.resolve(current));
    const before = await screen.findByRole("img", { name: /^処理前$/ });
    const obsolete = new Blob(["old"]);
    await act(async () => oldRead.resolve(obsolete));
    expect(blobs.get(before.getAttribute("src") as string)).toBe(current);
    expect(createUrl).not.toHaveBeenCalledWith(obsolete);
  });

  it("読み込み中と失敗時も処理後を表示し、例外で落ちない", async () => {
    const read = deferred();
    vi.mocked(loadSource).mockReturnValue(read.promise);
    render(<CompareDialog item={zipItem()} outputs={[output]} open onOpenChange={vi.fn()} />);
    expect(screen.getByText("処理前の画像を読み込み中…")).toBeTruthy();
    await screen.findByRole("img", { name: /^処理後$/ });
    await act(async () => read.reject(new Error("ZIP read failed")));
    expect(await screen.findByText("処理前の画像を読み込めませんでした")).toBeTruthy();
    expect(screen.queryByRole("img", { name: /^処理前$/ })).toBeNull();
    expect(screen.getByRole("img", { name: /^処理後$/ })).toBeTruthy();
  });
});
