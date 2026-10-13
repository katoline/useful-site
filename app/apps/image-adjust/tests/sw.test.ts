import { afterEach, describe, expect, it, vi } from "vitest";
import { SHARE_TARGET_CACHE, SHARE_TARGET_PATH } from "../shared/pwa";

vi.mock("workbox-core", () => ({
  cacheNames: { precache: "image-adjust-precache-test" },
  clientsClaim: vi.fn(),
  setCacheNameDetails: vi.fn(),
}));
vi.mock("workbox-precaching", () => ({ precacheAndRoute: vi.fn() }));

afterEach(() => vi.unstubAllGlobals());

describe("Service Worker の共有受け取り", () => {
  it("対応画像と ZIP だけ保存し、未対応の画像や HTML は捨てる", async () => {
    vi.resetModules();
    let receive:
      | ((event: { request: Request; respondWith: (response: Promise<Response>) => void }) => void)
      | undefined;
    vi.stubGlobal("self", {
      location: { origin: "https://example.com" },
      __WB_MANIFEST: [],
      addEventListener: (type: string, listener: typeof receive) => {
        if (type === "fetch") receive = listener;
      },
    });
    const put = vi.fn(async (_url: string, _response: Response) => {});
    const open = vi.fn(async () => ({ put }));
    const deleteCache = vi.fn(async () => true);
    vi.stubGlobal("caches", { open, delete: deleteCache });
    // DOM 用の型検査に SW のエントリーを混ぜない（SW は tsconfig.sw.json で検査する）。
    const swModulePath = "../sw/sw";
    await import(swModulePath);

    const form = new FormData();
    const files = [
      new File(["png"], "photo.PNG", { type: "application/octet-stream" }),
      new File(["jpeg"], "photo", { type: "image/jpeg" }),
      new File(["svg"], "drawing.svg", { type: "text/plain" }),
      new File(["zip"], "archive.ZIP"),
      new File(["zip"], "archive", { type: "application/x-zip-compressed" }),
      new File(["html"], "page.html", { type: "text/html" }),
      new File(["avif"], "photo.avif", { type: "image/avif" }),
      new File(["text"], "notes.txt", { type: "text/plain" }),
    ];
    for (const file of files) form.append("files", file);
    const request = new Request(`https://example.com${SHARE_TARGET_PATH}`, {
      method: "POST",
      headers: { "sec-fetch-site": "none" },
      body: form,
    });
    let response: Promise<Response> | undefined;
    expect(receive).toBeDefined();
    receive?.({
      request,
      respondWith: (value) => {
        response = value;
      },
    });
    expect((await response)?.status).toBe(303);
    expect(deleteCache).toHaveBeenCalledWith(SHARE_TARGET_CACHE);
    expect(open).toHaveBeenCalledWith(SHARE_TARGET_CACHE);
    expect(put).toHaveBeenCalledTimes(5);
    const names = put.mock.calls.map((call) => {
      const stored = call[1] as Response;
      return decodeURIComponent(stored.headers.get("x-file-name") ?? "");
    });
    expect(names).toEqual(files.slice(0, 5).map((file) => file.name));
  });
});
