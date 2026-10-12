import { afterEach, describe, expect, it, vi } from "vitest";
import { API_BASE_PATH } from "./config";
import {
  fetchRemoteImage,
  REMOTE_IMAGE_MAX_BYTES,
  RemoteImageError,
  remoteImageFileName,
} from "./remote-image";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

function stubFetch(impl: typeof fetch) {
  const mock = vi.fn<typeof fetch>(impl);
  vi.stubGlobal("fetch", mock);
  return mock;
}

async function codeOf(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    if (error instanceof RemoteImageError) return error.code;
    throw error;
  }
  throw new Error("成功してしまった");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchRemoteImage", () => {
  it("中継 API を呼び、File を返す", async () => {
    const mock = stubFetch(
      async () => new Response(PNG, { headers: { "Content-Type": "image/png" } }),
    );
    const file = await fetchRemoteImage("https://cdn.example.com/dir/photo.png?x=1");
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe("photo.png");
    expect(file.type).toBe("image/png");
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(PNG);
    const [input, init] = mock.mock.calls[0] ?? [];
    expect(input).toBe(
      `${API_BASE_PATH}/fetch-image?url=${encodeURIComponent("https://cdn.example.com/dir/photo.png?x=1")}`,
    );
    expect(init?.credentials).toBe("same-origin");
  });

  it.each([
    "invalid_url",
    "forbidden_host",
    "too_large",
    "not_image",
    "timeout",
    "rate_limited",
    "upstream_error",
  ] as const)("サーバーの %s をそのまま返す", async (code) => {
    stubFetch(async () => Response.json({ error: code }, { status: 400 }));
    expect(await codeOf(fetchRemoteImage("https://example.com/a.png"))).toBe(code);
  });

  it("forbidden_origin・未知のエラー・JSON でない応答は upstream_error にまとめる", async () => {
    stubFetch(async () => Response.json({ error: "forbidden_origin" }, { status: 403 }));
    expect(await codeOf(fetchRemoteImage("https://example.com/a.png"))).toBe("upstream_error");
    stubFetch(async () => new Response("<html>bad gateway</html>", { status: 502 }));
    expect(await codeOf(fetchRemoteImage("https://example.com/a.png"))).toBe("upstream_error");
    stubFetch(async () => new Response("slow down", { status: 429 }));
    expect(await codeOf(fetchRemoteImage("https://example.com/a.png"))).toBe("rate_limited");
  });

  it("通信失敗は network", async () => {
    stubFetch(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await codeOf(fetchRemoteImage("https://example.com/a.png"))).toBe("network");
  });

  it("ボディの途中で切れたら network", async () => {
    stubFetch(async () => {
      let sent = false;
      const body = new ReadableStream<Uint8Array>({
        pull(controller) {
          if (!sent) {
            sent = true;
            controller.enqueue(PNG);
          } else {
            controller.error(new TypeError("connection reset"));
          }
        },
      });
      return new Response(body, { headers: { "Content-Type": "image/png" } });
    });
    expect(await codeOf(fetchRemoteImage("https://example.com/a.png"))).toBe("network");
  });

  it("上限を超えるボディは too_large", async () => {
    stubFetch(async () => {
      const chunk = new Uint8Array(1024 * 1024);
      let sent = 0;
      const body = new ReadableStream<Uint8Array>({
        pull(controller) {
          sent += chunk.byteLength;
          if (sent > REMOTE_IMAGE_MAX_BYTES + chunk.byteLength) controller.close();
          else controller.enqueue(chunk);
        },
      });
      return new Response(body, { headers: { "Content-Type": "image/png" } });
    });
    expect(await codeOf(fetchRemoteImage("https://example.com/a.png"))).toBe("too_large");
  });

  it("想定外の Content-Type は not_image", async () => {
    stubFetch(async () => new Response("<p>", { headers: { "Content-Type": "text/html" } }));
    expect(await codeOf(fetchRemoteImage("https://example.com/a.png"))).toBe("not_image");
  });

  it.each(["", "not a url", "ftp://example.com/a.png", "javascript:alert(1)"])(
    "不正な URL は API を呼ばずに invalid_url: %s",
    async (url) => {
      const mock = stubFetch(async () => new Response(PNG));
      expect(await codeOf(fetchRemoteImage(url))).toBe("invalid_url");
      expect(mock).not.toHaveBeenCalled();
    },
  );

  it("中断したら中断の例外をそのまま投げる", async () => {
    stubFetch(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        }),
    );
    const controller = new AbortController();
    const promise = fetchRemoteImage("https://example.com/a.png", controller.signal);
    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    await expect(promise).rejects.not.toBeInstanceOf(RemoteImageError);
  });
});

describe("remoteImageFileName", () => {
  it.each([
    ["https://example.com/a/photo.png", "image/png", "photo.png"],
    ["https://example.com/a/photo.JPEG", "image/jpeg", "photo.JPEG"],
    ["https://example.com/a/photo.php?id=1", "image/png", "photo.png"],
    ["https://example.com/a/photo", "image/webp", "photo.webp"],
    ["https://example.com/", "image/gif", "image.gif"],
    ["https://example.com/%E5%86%99%E7%9C%9F.jpg", "image/jpeg", "写真.jpg"],
    ["https://example.com/a%2F..%2Fb%3A.svg", "image/svg+xml", "a_.._b_.svg"],
    ["https://example.com/..png", "image/png", "png.png"],
    ["https://example.com/%E0%A4%A", "image/png", "%E0%A4%A.png"],
  ])("%s (%s) → %s", (url, type, expected) => {
    expect(remoteImageFileName(url, type)).toBe(expected);
  });
});
