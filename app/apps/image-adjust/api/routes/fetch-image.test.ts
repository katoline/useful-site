import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../../../../../worker/index";
import { API_BASE_PATH, SITE_ORIGIN } from "../../lib/config";
import type { Env } from "../env";
import { createFetchImageRoute, type FetchImageOptions, UPSTREAM_USER_AGENT } from "./fetch-image";

const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52, 1, 2, 3,
]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 1]);
const WEBP = new TextEncoder().encode("RIFF\x10\x00\x00\x00WEBPVP8 rest-of-file");
const GIF = new TextEncoder().encode("GIF89a\x01\x00\x01\x00rest");
const SVG = new TextEncoder().encode(
  '<?xml version="1.0"?>\n<!-- c -->\n<svg xmlns="http://www.w3.org/2000/svg"></svg>',
);
const HTML = new TextEncoder().encode("<!doctype html><html><script>alert(1)</script></html>");

const SITE_HOST = new URL(SITE_ORIGIN).host;
const sameOrigin = { "Sec-Fetch-Site": "same-origin", Referer: `${SITE_ORIGIN}/image-adjust/` };

type FetchMock = ReturnType<typeof vi.fn<typeof fetch>>;

function makeApp(fetchMock: FetchMock, options: Omit<FetchImageOptions, "fetch"> = {}) {
  return new Hono<{ Bindings: Env }>()
    .basePath(API_BASE_PATH)
    .route("/fetch-image", createFetchImageRoute({ fetch: fetchMock, ...options }));
}

function callApi(
  app: Hono<{ Bindings: Env }>,
  target: string,
  headers: Record<string, string> = sameOrigin,
  env: Partial<Env> = {},
) {
  return app.request(
    `${SITE_ORIGIN}${API_BASE_PATH}/fetch-image?url=${encodeURIComponent(target)}`,
    { headers },
    env as Env,
  );
}

function imageResponse(bytes: Uint8Array, contentType: string, extra: Record<string, string> = {}) {
  return new Response(bytes, { status: 200, headers: { "Content-Type": contentType, ...extra } });
}

function redirect(location: string, status = 302) {
  return new Response(null, { status, headers: { Location: location } });
}

/** 指定バイト数を chunk 単位で流し続けるストリーム（Content-Length なし） */
function endlessStream(chunkSize: number, totalChunks: number, first: Uint8Array) {
  let sent = 0;
  let pulls = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulls++;
      if (sent === 0) {
        controller.enqueue(first);
      } else if (sent < totalChunks) {
        controller.enqueue(new Uint8Array(chunkSize));
      } else {
        controller.close();
      }
      sent++;
    },
  });
  return { stream, pulls: () => pulls };
}

async function errorCode(res: Response) {
  return ((await res.json()) as { error: string }).error;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetch-image", () => {
  it("正常系：判定した Content-Type・no-store・nosniff でストリームを返す", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      imageResponse(PNG, "image/png; charset=binary", { "Set-Cookie": "a=b", "X-Foo": "1" }),
    );
    const res = await callApi(makeApp(fetchMock), "https://cdn.example.com/a.png#x");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-security-policy")).toBe("default-src 'none'; sandbox");
    expect(res.headers.get("content-disposition")).toMatch(/^attachment/);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(res.headers.get("x-foo")).toBeNull();
    expect(res.body).toBeInstanceOf(ReadableStream);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG);

    // 上流には固定の UA だけを送り、リダイレクトは手動、キャッシュしない
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [input, init] = fetchMock.mock.calls[0] ?? [];
    expect(input).toBe("https://cdn.example.com/a.png");
    expect(init?.redirect).toBe("manual");
    expect(init?.cache).toBe("no-store");
    const sent = new Headers(init?.headers);
    expect(sent.get("user-agent")).toBe(UPSTREAM_USER_AGENT);
    expect(sent.get("cookie")).toBeNull();
    expect(sent.get("authorization")).toBeNull();
  });

  it("利用者の Cookie・Authorization を上流に転送しない", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => imageResponse(PNG, "image/png"));
    await callApi(makeApp(fetchMock), "https://cdn.example.com/a.png", {
      ...sameOrigin,
      Cookie: "session=secret",
      Authorization: "Bearer secret",
    });
    const sent = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect([...sent.keys()].sort()).toEqual(["accept", "user-agent"]);
  });

  it.each([
    ["jpeg", JPEG, "image/jpeg", "image/jpeg"],
    ["webp", WEBP, "image/webp", "image/webp"],
    ["gif", GIF, "image/gif", "image/gif"],
    ["svg", SVG, "image/svg+xml", "image/svg+xml"],
    // 上流の Content-Type が違っても、中身の形式で返す
    ["png を image/jpeg と名乗る", PNG, "image/jpeg", "image/png"],
  ])("%s を判定する", async (_name, bytes, upstreamType, expected) => {
    const fetchMock = vi.fn<typeof fetch>(async () => imageResponse(bytes, upstreamType));
    const res = await callApi(makeApp(fetchMock), "https://cdn.example.com/x");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe(expected);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes);
  });

  it("1 バイトずつ届いても先頭バイトを判定できる", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => {
      let i = 0;
      const body = new ReadableStream<Uint8Array>({
        pull(controller) {
          if (i < SVG.length) controller.enqueue(SVG.subarray(i, ++i));
          else controller.close();
        },
      });
      return new Response(body, { headers: { "Content-Type": "image/svg+xml" } });
    });
    const res = await callApi(makeApp(fetchMock), "https://cdn.example.com/x.svg");
    expect(res.status).toBe(200);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(SVG);
  });

  it("Content-Type が text/html なら中身が PNG でも not_image", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => imageResponse(PNG, "text/html"));
    const res = await callApi(makeApp(fetchMock), "https://cdn.example.com/a.png");
    expect(res.status).toBe(415);
    expect(await errorCode(res)).toBe("not_image");
  });

  it.each([
    ["image/png", HTML],
    ["image/svg+xml", HTML],
    // SVG の中身でも、上流が SVG と名乗っていなければ通さない
    ["image/png", SVG],
    ["image/png", new Uint8Array()],
  ])("Content-Type %s で中身が画像でなければ not_image", async (type, bytes) => {
    const fetchMock = vi.fn<typeof fetch>(async () => imageResponse(bytes, type));
    const res = await callApi(makeApp(fetchMock), "https://cdn.example.com/a.png");
    expect(res.status).toBe(415);
    expect(await errorCode(res)).toBe("not_image");
  });

  it("リダイレクトを 3 回まで追従し、毎回手動で検査する", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith("/1")) return redirect("/2", 301);
      if (url.endsWith("/2")) return redirect("https://b.example.net/3", 307);
      if (url.endsWith("/3")) return redirect("4", 308);
      return imageResponse(PNG, "image/png");
    });
    const res = await callApi(makeApp(fetchMock), "https://a.example.com/1");
    expect(res.status).toBe(200);
    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual([
      "https://a.example.com/1",
      "https://a.example.com/2",
      "https://b.example.net/3",
      "https://b.example.net/4",
    ]);
  });

  it("4 回目のリダイレクトは拒否する", async () => {
    let n = 0;
    const fetchMock = vi.fn<typeof fetch>(async () => redirect(`/r${++n}`));
    const res = await callApi(makeApp(fetchMock), "https://a.example.com/r0");
    expect(res.status).toBe(502);
    expect(await errorCode(res)).toBe("upstream_error");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it.each([
    "http://127.0.0.1/a.png",
    "http://169.254.169.254/latest/meta-data/",
    "http://localhost:8080/",
    "http://[::ffff:127.0.0.1]/",
    "//intranet/a.png",
    "http://nas.local/a.png",
  ])("リダイレクト先が禁止ホストなら拒否する: %s", async (location) => {
    const fetchMock = vi.fn<typeof fetch>(async () => redirect(location));
    const res = await callApi(makeApp(fetchMock), "https://a.example.com/a.png");
    expect(res.status).toBe(403);
    expect(await errorCode(res)).toBe("forbidden_host");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("自ドメインへの取得とリダイレクトを拒否する", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => redirect(`${SITE_ORIGIN}/other-app/`));
    const direct = await callApi(makeApp(fetchMock), `${SITE_ORIGIN}/image-adjust/api/health`);
    expect(direct.status).toBe(403);
    expect(await errorCode(direct)).toBe("forbidden_host");
    expect(fetchMock).not.toHaveBeenCalled();

    const viaRedirect = await callApi(makeApp(fetchMock), "https://a.example.com/a.png");
    expect(viaRedirect.status).toBe(403);
    expect(await errorCode(viaRedirect)).toBe("forbidden_host");
  });

  it("リクエスト自身の Host への取得も拒否する", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => imageResponse(PNG, "image/png"));
    const app = makeApp(fetchMock);
    const res = await app.request(
      `https://custom.example.jp${API_BASE_PATH}/fetch-image?url=${encodeURIComponent("https://sub.custom.example.jp/a.png")}`,
      { headers: { "Sec-Fetch-Site": "same-origin" } },
      {} as Env,
    );
    expect(res.status).toBe(403);
    expect(await errorCode(res)).toBe("forbidden_host");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["", "invalid_url", 400],
    ["file:///etc/passwd", "invalid_url", 400],
    ["http://2130706433/", "forbidden_host", 403],
    ["https://example.com:8443/a.png", "forbidden_host", 403],
  ])("入力 URL を検査する: %s", async (target, code, status) => {
    const fetchMock = vi.fn<typeof fetch>();
    const res = await callApi(makeApp(fetchMock), target);
    expect(res.status).toBe(status);
    expect(await errorCode(res)).toBe(code);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("Content-Length が上限を超えていれば読まずに too_large", async () => {
    const cancel = vi.fn();
    const fetchMock = vi.fn<typeof fetch>(async () => {
      const body = new ReadableStream<Uint8Array>({ cancel });
      return new Response(body, {
        headers: { "Content-Type": "image/png", "Content-Length": String(25 * 1024 * 1024 + 1) },
      });
    });
    const res = await callApi(makeApp(fetchMock), "https://cdn.example.com/a.png");
    expect(res.status).toBe(413);
    expect(await errorCode(res)).toBe("too_large");
    expect(cancel).toHaveBeenCalled();
  });

  it("Content-Length が無い・偽りでも、ストリームで数えて上限を超えたら打ち切る", async () => {
    const { stream, pulls } = endlessStream(1024, 1000, PNG);
    const fetchMock = vi.fn<typeof fetch>(
      async () =>
        new Response(stream, { headers: { "Content-Type": "image/png", "Content-Length": "10" } }),
    );
    const res = await callApi(
      makeApp(fetchMock, { maxBytes: 8 * 1024 }),
      "https://cdn.example.com/a",
    );
    expect(res.status).toBe(200);
    await expect(res.arrayBuffer()).rejects.toThrow();
    // 上限を少し超えたところで上流の読み取りをやめる
    expect(pulls()).toBeLessThan(20);
  });

  it.each([
    // 報告された入力：空白で埋めて <svg がちょうど判定範囲の末尾に来る形
    [`${" ".repeat(1020)}<svg`],
    [`\ufeff${" ".repeat(1017)}<svg`],
    [`<?xml version='1.0'?>${" ".repeat(1100)}`],
    [`<!-- ${"x".repeat(1100)}`],
    [" ".repeat(1100)],
    [`<!do${" ".repeat(1100)}`],
  ])("判定が付かない SVG 風の入力は数 KB で打ち切って not_image: %#", async (prefix) => {
    const first = new TextEncoder().encode(prefix);
    let pulled = 0;
    let sentFirst = false;
    const cancel = vi.fn();
    const fetchMock = vi.fn<typeof fetch>(
      async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            pull(controller) {
              // 先頭を 256 バイトずつ送り、その後は 25MB 分のゴミを送り続ける（Content-Length なし）
              if (!sentFirst) {
                sentFirst = true;
                for (let i = 0; i < first.length; i += 256) {
                  controller.enqueue(first.subarray(i, i + 256));
                }
                pulled += first.length;
                return;
              }
              pulled += 512;
              if (pulled > 25 * 1024 * 1024) controller.close();
              else controller.enqueue(new Uint8Array(512).fill(0x78));
            },
            cancel,
          }),
          { headers: { "Content-Type": "image/svg+xml" } },
        ),
    );
    const res = await callApi(makeApp(fetchMock), "https://cdn.example.com/x.svg");
    expect(res.status).toBe(415);
    expect(await errorCode(res)).toBe("not_image");
    expect(pulled).toBeLessThan(4 * 1024);
    expect(cancel).toHaveBeenCalled();
  });

  it("先頭の判定中に上限を超えたら too_large", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      imageResponse(new Uint8Array(64), "image/png"),
    );
    const res = await callApi(makeApp(fetchMock, { maxBytes: 4 }), "https://cdn.example.com/a");
    expect(res.status).toBe(413);
  });

  it("上流が応答しなければ timeout", async () => {
    const fetchMock = vi.fn<typeof fetch>(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        }),
    );
    const res = await callApi(makeApp(fetchMock, { timeoutMs: 30 }), "https://slow.example.com/a");
    expect(res.status).toBe(504);
    expect(await errorCode(res)).toBe("timeout");
  });

  it("先頭バイトの前で止まっても timeout", async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async () =>
        new Response(new ReadableStream<Uint8Array>({ pull() {} }), {
          headers: { "Content-Type": "image/png" },
        }),
    );
    const res = await callApi(makeApp(fetchMock, { timeoutMs: 30 }), "https://slow.example.com/a");
    expect(res.status).toBe(504);
  });

  it("ボディの途中で止まったら時間切れで打ち切る", async () => {
    let sent = false;
    const fetchMock = vi.fn<typeof fetch>(
      async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            pull(controller) {
              if (!sent) controller.enqueue(PNG);
              sent = true;
            },
          }),
          { headers: { "Content-Type": "image/png" } },
        ),
    );
    const res = await callApi(makeApp(fetchMock, { timeoutMs: 50 }), "https://slow.example.com/a");
    expect(res.status).toBe(200);
    await expect(res.arrayBuffer()).rejects.toBeDefined();
  });

  it("上流のエラー・通信失敗は upstream_error", async () => {
    const notFound = vi.fn<typeof fetch>(async () => new Response("nope", { status: 404 }));
    const res1 = await callApi(makeApp(notFound), "https://cdn.example.com/a.png");
    expect(res1.status).toBe(502);
    expect(await errorCode(res1)).toBe("upstream_error");

    const failing = vi.fn<typeof fetch>(async () => {
      throw new TypeError("network");
    });
    const res2 = await callApi(makeApp(failing), "https://cdn.example.com/a.png");
    expect(await errorCode(res2)).toBe("upstream_error");
  });

  describe("呼び出し元の検査", () => {
    const fetchMock = () => vi.fn<typeof fetch>(async () => imageResponse(PNG, "image/png"));

    it.each([
      [{ Origin: "https://evil.example" }],
      [{ Origin: "null" }],
      [{ Referer: "https://evil.example/page" }],
      [{ "Sec-Fetch-Site": "cross-site", Referer: `${SITE_ORIGIN}/` }],
      [{ "Sec-Fetch-Site": "same-site" }],
      [{ "Sec-Fetch-Site": "none" }],
      [{ Origin: `https://sub.${SITE_HOST}` }],
      // ヘッダーが何も無いもの（ブラウザ以外）
      [{}],
      // 本番で localhost のオリジンは通さない
      [{ Origin: "http://localhost:5173" }],
    ])("自サイト以外を forbidden_origin にする: %j", async (headers) => {
      const mock = fetchMock();
      const res = await callApi(makeApp(mock), "https://cdn.example.com/a.png", headers);
      expect(res.status).toBe(403);
      expect(await errorCode(res)).toBe("forbidden_origin");
      expect(mock).not.toHaveBeenCalled();
    });

    it.each([
      [{ Origin: SITE_ORIGIN }],
      [{ Referer: `${SITE_ORIGIN}/image-adjust/en/` }],
      [{ "Sec-Fetch-Site": "same-origin" }],
      [{ "Sec-Fetch-Site": "same-origin", Origin: SITE_ORIGIN }],
    ])("自サイトからの呼び出しを通す: %j", async (headers) => {
      const res = await callApi(makeApp(fetchMock()), "https://cdn.example.com/a.png", headers);
      expect(res.status).toBe(200);
    });

    it("開発時（localhost 宛て）は localhost の任意ポートのオリジンを通す", async () => {
      const res = await makeApp(fetchMock()).request(
        `http://localhost:4173${API_BASE_PATH}/fetch-image?url=${encodeURIComponent("https://cdn.example.com/a.png")}`,
        { headers: { Origin: "http://localhost:5173" } },
        {} as Env,
      );
      expect(res.status).toBe(200);
    });
  });

  describe("回数制限", () => {
    it("バインディングが拒否したら 429 rate_limited、キーは CF-Connecting-IP", async () => {
      const limit = vi.fn(async () => ({ success: false }));
      const mock = vi.fn<typeof fetch>();
      const res = await callApi(
        makeApp(mock),
        "https://cdn.example.com/a.png",
        { ...sameOrigin, "CF-Connecting-IP": "203.0.113.5" },
        { FETCH_IMAGE_RATE_LIMITER: { limit } },
      );
      expect(res.status).toBe(429);
      expect(await errorCode(res)).toBe("rate_limited");
      expect(limit).toHaveBeenCalledWith({ key: "203.0.113.5" });
      expect(mock).not.toHaveBeenCalled();
    });

    it("IPv6 は /64 単位、IPv4-mapped は IPv4 のキーで数える", async () => {
      const limit = vi.fn(async () => ({ success: true }));
      const app = makeApp(vi.fn<typeof fetch>(async () => imageResponse(PNG, "image/png")));
      for (const ip of ["2001:db8:1:2::1", "2001:db8:1:2:aaaa::9", "::ffff:192.0.2.7"]) {
        const res = await callApi(
          app,
          "https://cdn.example.com/a.png",
          { ...sameOrigin, "CF-Connecting-IP": ip },
          { FETCH_IMAGE_RATE_LIMITER: { limit } },
        );
        await res.body?.cancel();
      }
      expect(limit.mock.calls.map((call) => (call as unknown as [{ key: string }])[0].key)).toEqual(
        ["2001:db8:1:2::/64", "2001:db8:1:2::/64", "192.0.2.7"],
      );
    });

    it("許可されれば取得する", async () => {
      const limit = vi.fn(async () => ({ success: true }));
      const res = await callApi(
        makeApp(vi.fn<typeof fetch>(async () => imageResponse(PNG, "image/png"))),
        "https://cdn.example.com/a.png",
        sameOrigin,
        { FETCH_IMAGE_RATE_LIMITER: { limit } },
      );
      expect(res.status).toBe(200);
    });

    it("1 分 20 回を超えると 429（簡易な制限器で確認）", async () => {
      const counts = new Map<string, number>();
      const limiter = {
        limit: async ({ key }: { key: string }) => {
          const n = (counts.get(key) ?? 0) + 1;
          counts.set(key, n);
          return { success: n <= 20 };
        },
      };
      const app = makeApp(vi.fn<typeof fetch>(async () => imageResponse(PNG, "image/png")));
      const headers = { ...sameOrigin, "CF-Connecting-IP": "198.51.100.1" };
      const statuses: number[] = [];
      for (let i = 0; i < 21; i++) {
        const res = await callApi(app, "https://cdn.example.com/a.png", headers, {
          FETCH_IMAGE_RATE_LIMITER: limiter,
        });
        await res.body?.cancel();
        statuses.push(res.status);
      }
      expect(statuses.slice(0, 20).every((s) => s === 200)).toBe(true);
      expect(statuses[20]).toBe(429);
    });
  });

  it("Worker のエントリから /image-adjust/api/fetch-image に届く", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async () => imageResponse(PNG, "image/png")),
    );
    const env = { ASSETS: { fetch: async () => new Response("asset") } } as unknown as Env;
    const res = await worker.fetch(
      new Request(
        `${SITE_ORIGIN}${API_BASE_PATH}/fetch-image?url=${encodeURIComponent("https://cdn.example.com/a.png")}`,
        { headers: sameOrigin },
      ) as Request<unknown, IncomingRequestCfProperties>,
      env,
      {} as ExecutionContext,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
  });
});
