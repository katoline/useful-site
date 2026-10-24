/**
 * 回線速度テストの測定 API（/speed-test/api/*）。
 * - GET  /ping           ：空の応答（応答までの時間を測る）
 * - GET  /info           ：測定に使うデータセンターと回線の情報（Cloudflare が付ける request.cf）
 * - GET  /down?bytes=N   ：N バイトの乱数を返す（MAX_DOWNLOAD_BYTES まで）
 * - POST /up             ：受け取った本文を数えて捨てる（MAX_UPLOAD_BYTES まで）
 *
 * どれもキャッシュさせない。測定のデータは保存も記録もしない。
 * 他サイトからの呼び出しは origin-guard で、使いすぎは IP ごとの回数制限で止める
 * （測定の開始は 1 分 10 回、転送は 1 分 1200 回。開発・preview の loopback では制限しない。
 * 利用者ごとの IP が無く、全員が 1 つのキーに数えられるため）。
 */
import { Hono } from "hono";
import { isAllowedCaller, isLoopbackHost } from "../../../platform/api/origin-guard";
import { rateLimitKey } from "../../../platform/api/rate-limit-key";
import { SITE_ORIGIN } from "../../../platform/config";
import { MAX_DOWNLOAD_BYTES, MAX_UPLOAD_BYTES } from "../domain/limits";
import type { ServerInfo } from "../domain/measurement";
import { manifest } from "../manifest";
import type { Env } from "./env";

export const appPath = manifest.path;
export const api = new Hono<{ Bindings: Env }>();

const NO_STORE = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
/**
 * 返す乱数のかたまり。中身を書き換えないので、同じものを何度も送ってよい（コピーしない）。
 * 1 回の要求ごとにコピーすると 1MB あたり 1ms ほどの CPU を使い、無料プランの上限（1 回 10ms）を超えるため
 */
const CHUNK_BYTES = 1024 * 1024;

// Workers はグローバルの範囲で乱数を作れないので、最初の要求で作る
let randomChunk: Uint8Array | undefined;
function chunk(): Uint8Array {
  if (!randomChunk) {
    randomChunk = new Uint8Array(CHUNK_BYTES);
    // getRandomValues は 1 回 65536 バイトまで
    for (let offset = 0; offset < CHUNK_BYTES; offset += 65536) {
      crypto.getRandomValues(randomChunk.subarray(offset, offset + 65536));
    }
  }
  return randomChunk;
}

function error(status: 400 | 403 | 404 | 413 | 429 | 503, code: string) {
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: { ...NO_STORE, "Content-Type": "application/json" },
  });
}

api.use("*", async (c, next) => {
  const requestUrl = new URL(c.req.url);
  if (!isAllowedCaller(c.req.raw.headers, requestUrl, SITE_ORIGIN)) {
    return error(403, "forbidden_origin");
  }
  if (isLoopbackHost(requestUrl.hostname)) {
    await next();
    return;
  }
  const limiter = requestUrl.pathname.endsWith("/info")
    ? c.env?.SPEED_TEST_START_LIMITER
    : c.env?.SPEED_TEST_TRANSFER_LIMITER;
  // 本番でバインディングが無い（設定漏れ）なら止める
  if (!limiter) return error(503, "unavailable");
  const key = rateLimitKey(c.req.header("cf-connecting-ip"));
  if (!(await limiter.limit({ key })).success) return error(429, "rate_limited");
  await next();
});

api.get("/ping", () => new Response(null, { status: 204, headers: NO_STORE }));

api.get("/info", (c) => {
  const cf = c.req.raw.cf as IncomingRequestCfProperties | undefined;
  const info: ServerInfo = {
    colo: typeof cf?.colo === "string" ? cf.colo : null,
    country: typeof cf?.country === "string" ? cf.country : null,
    isp: typeof cf?.asOrganization === "string" ? cf.asOrganization : null,
  };
  return c.json(info, 200, NO_STORE);
});

/** 0 以上の整数のバイト数（上限つき）。不正なら undefined */
export function parseBytes(value: string | undefined, max: number): number | undefined {
  if (value === undefined || !/^\d{1,12}$/.test(value)) return undefined;
  const bytes = Number(value);
  return bytes <= max ? bytes : undefined;
}

api.get("/down", (c) => {
  const bytes = parseBytes(c.req.query("bytes"), MAX_DOWNLOAD_BYTES);
  if (bytes === undefined) return error(400, "bad_request");
  const source = chunk();
  let remaining = bytes;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (remaining <= 0) {
        controller.close();
        return;
      }
      const size = Math.min(remaining, source.byteLength);
      // 写さずに渡す（subarray は同じメモリを指すだけ）
      controller.enqueue(size === source.byteLength ? source : source.subarray(0, size));
      remaining -= size;
    },
  });
  const headers = {
    ...NO_STORE,
    // 圧縮されない形式にする（乱数なので縮まない）
    "Content-Type": "application/octet-stream",
  };
  // Workers では FixedLengthStream を通すと Content-Length が付く（進み具合を出せる）。Node（テスト）には無い
  if (typeof FixedLengthStream === "function") {
    const fixed = new FixedLengthStream(bytes);
    // 相手が途中で切ると pipe は失敗するが、それで良い（応答の本文が流れている間は Worker は動き続ける）
    void body.pipeTo(fixed.writable).catch(() => undefined);
    return new Response(fixed.readable, { headers });
  }
  return new Response(body, { headers });
});

api.post("/up", async (c) => {
  const declared = c.req.header("content-length");
  if (declared !== undefined && Number(declared) > MAX_UPLOAD_BYTES) {
    return error(413, "too_large");
  }
  const reader = c.req.raw.body?.getReader();
  let received = 0;
  if (reader) {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_UPLOAD_BYTES) {
        await reader.cancel();
        return error(413, "too_large");
      }
    }
  }
  return c.json({ bytes: received }, 200, NO_STORE);
});

api.notFound(() => error(404, "not_found"));
