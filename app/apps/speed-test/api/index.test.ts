import { describe, expect, it } from "vitest";
import type { Env } from "../../../../worker/env";
import worker from "../../../../worker/index";
import { MAX_DOWNLOAD_BYTES, MAX_UPLOAD_BYTES } from "../domain/limits";
import { parseBytes } from "./index";

const ctx = {} as ExecutionContext;
const SAME_ORIGIN = { "sec-fetch-site": "same-origin" };

function call(
  path: string,
  init: RequestInit = {},
  env: Partial<Env> & Record<string, unknown> = {},
) {
  const request = new Request(`http://localhost/speed-test/api/${path}`, {
    ...init,
    headers: { ...SAME_ORIGIN, ...(init.headers as Record<string, string>) },
  }) as Request<unknown, IncomingRequestCfProperties>;
  return worker.fetch(
    request,
    { ASSETS: { fetch: async () => new Response("asset") }, ...env } as unknown as Env,
    ctx,
  );
}

describe("speed-test の API", () => {
  it("ping は空の 204 でキャッシュさせない", async () => {
    const res = await call("ping");
    expect(res.status).toBe(204);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("info は Cloudflare の情報を返し、無ければ null", async () => {
    const res = await call("info");
    expect(await res.json()).toEqual({ colo: null, country: null, isp: null });
  });

  it("down は指定のバイト数を返す", async () => {
    const res = await call("down?bytes=200000");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/octet-stream");
    expect((await res.arrayBuffer()).byteLength).toBe(200000);
  });

  it("down の不正な・大きすぎる指定は 400", async () => {
    expect((await call("down")).status).toBe(400);
    expect((await call("down?bytes=-1")).status).toBe(400);
    expect((await call(`down?bytes=${MAX_DOWNLOAD_BYTES + 1}`)).status).toBe(400);
  });

  it("up は受け取ったバイト数を返す", async () => {
    const res = await call("up", { method: "POST", body: new Uint8Array(123456) });
    expect(await res.json()).toEqual({ bytes: 123456 });
  });

  it("up の大きすぎる本文は 413", async () => {
    const res = await call("up", {
      method: "POST",
      body: new Uint8Array(8),
      headers: { "content-length": String(MAX_UPLOAD_BYTES + 1) },
    });
    expect(res.status).toBe(413);
  });

  it("他サイトからの呼び出しは 403", async () => {
    const res = await call("ping", { headers: { "sec-fetch-site": "cross-site" } });
    expect(res.status).toBe(403);
  });

  it("回数制限を超えたら 429。開始（info）と転送で別に数える", async () => {
    const deny = { limit: async () => ({ success: false }) };
    const allow = { limit: async () => ({ success: true }) };
    const remote = (path: string, env: Record<string, unknown>) =>
      worker.fetch(
        new Request(`https://example.com/speed-test/api/${path}`, {
          headers: { origin: "https://example.com" },
        }) as Request<unknown, IncomingRequestCfProperties>,
        { ASSETS: {}, ...env } as unknown as Env,
        ctx,
      );
    const env = { SPEED_TEST_START_LIMITER: deny, SPEED_TEST_TRANSFER_LIMITER: allow };
    expect((await remote("info", env)).status).toBe(429);
    expect((await remote("ping", env)).status).toBe(204);
  });

  it("loopback（開発・preview）では回数制限をかけない", async () => {
    const deny = { limit: async () => ({ success: false }) };
    const res = await call("ping", {}, { SPEED_TEST_TRANSFER_LIMITER: deny });
    expect(res.status).toBe(204);
  });

  it("loopback 以外でバインディングが無ければ止める", async () => {
    const request = new Request("https://example.com/speed-test/api/ping", {
      headers: { origin: "https://example.com" },
    }) as Request<unknown, IncomingRequestCfProperties>;
    const res = await worker.fetch(request, { ASSETS: {} } as unknown as Env, ctx);
    expect(res.status).toBe(503);
  });

  it("バイト数の読み取り", () => {
    expect(parseBytes("1024", 2048)).toBe(1024);
    expect(parseBytes("0", 2048)).toBe(0);
    expect(parseBytes("1e3", 2048)).toBeUndefined();
    expect(parseBytes("4096", 2048)).toBeUndefined();
    expect(parseBytes(undefined, 2048)).toBeUndefined();
  });
});
