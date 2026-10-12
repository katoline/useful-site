/**
 * GET /image-adjust/api/fetch-image?url=...
 * 指定 URL の画像をサーバー側で取得し、ストリームのまま返す中継 API（plan.md §3.5）。
 * 保存・キャッシュはしない。悪用対策（SSRF・オープンプロキシ化）は次のとおり。
 *
 * - 呼び出し元：Origin / Referer / Sec-Fetch-Site で自サイトからの呼び出しだけ通す（origin-guard）
 * - 回数制限：Workers Rate Limiting バインディング（CF-Connecting-IP ごと、1 分 20 回）
 * - 取得先：http/https・既定ポートのみ、IP 直指定・ローカル名・自ドメインを拒否（url-guard）
 * - リダイレクト：自動追従せず、最大 3 回まで毎回同じ検査をして追従する
 * - 応答：Content-Type が image/* かつ先頭バイトが PNG/JPEG/GIF/WebP/SVG のものだけ。
 *   返す Content-Type は判定した形式から決める。25MB・10 秒（ボディの読み取りを含む）で打ち切る
 */
import type { Context } from "hono";
import { Hono } from "hono";
import { SITE_ORIGIN } from "../../app/lib/config";
import type { Env } from "../env";
import {
  FORMAT_CONTENT_TYPES,
  type SniffedFormat,
  sniffImage,
  TEXT_SNIFF_BYTES,
} from "../lib/image-sniff";
import { isAllowedCaller } from "../lib/origin-guard";
import { rateLimitKey } from "../lib/rate-limit-key";
import { ownHostSuffixes, parseAndCheckUrl, resolveRedirect } from "../lib/url-guard";

export type FetchImageError =
  | "invalid_url"
  | "forbidden_host"
  | "too_large"
  | "not_image"
  | "timeout"
  | "rate_limited"
  | "upstream_error"
  | "forbidden_origin";

const ERROR_STATUS = {
  invalid_url: 400,
  forbidden_host: 403,
  forbidden_origin: 403,
  too_large: 413,
  not_image: 415,
  rate_limited: 429,
  upstream_error: 502,
  timeout: 504,
} as const satisfies Record<FetchImageError, number>;

export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
export const FETCH_TIMEOUT_MS = 10_000;
export const MAX_REDIRECTS = 3;

/** 形式の判定のためにバッファしてよい量の上限（判定に要る量＋1 チャンク程度の余裕） */
export const MAX_SNIFF_BUFFER_BYTES = TEXT_SNIFF_BYTES + 64 * 1024;

/** 上流に送る User-Agent（固定。利用者のものは転送しない） */
export const UPSTREAM_USER_AGENT = "ImageAdjustFetcher/1.0";

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/** 応答（成功・失敗とも）に付ける共通ヘッダー */
const COMMON_HEADERS: Record<string, string> = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  // API の URL を直接開かれても（SVG 等）スクリプトを動かさない
  "Content-Security-Policy": "default-src 'none'; sandbox",
  // 他サイトの <img> 等から読み込ませない
  "Cross-Origin-Resource-Policy": "same-origin",
  "Referrer-Policy": "no-referrer",
};

class FetchImageFailure extends Error {
  constructor(readonly code: FetchImageError) {
    super(code);
  }
}

export interface FetchImageOptions {
  /** 上流への fetch（テストで差し替える）。既定は実行時の globalThis.fetch */
  fetch?: typeof fetch;
  timeoutMs?: number;
  maxBytes?: number;
}

function errorResponse(code: FetchImageError): Response {
  return new Response(JSON.stringify({ error: code }), {
    status: ERROR_STATUS[code],
    headers: { ...COMMON_HEADERS, "Content-Type": "application/json; charset=utf-8" },
  });
}

/** reader.read() を signal の中断と競わせる（上流がボディを送らずに止まった場合も打ち切る） */
function readWithSignal<T>(
  reader: ReadableStreamDefaultReader<T>,
  signal: AbortSignal,
): Promise<ReadableStreamReadResult<T>> {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      reader.cancel(signal.reason).catch(() => {});
      reject(signal.reason);
    };
    signal.addEventListener("abort", onAbort, { once: true });
    reader.read().then(
      (result) => {
        signal.removeEventListener("abort", onAbort);
        resolve(result);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

function concat(chunks: readonly Uint8Array[], limit: number): Uint8Array {
  const total = Math.min(
    limit,
    chunks.reduce((n, c) => n + c.byteLength, 0),
  );
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    if (offset >= total) break;
    const part = chunk.subarray(0, total - offset);
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}

function mediaType(contentType: string | null): string {
  return (contentType ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
}

/** 中断の理由が時間切れか */
function isTimeout(timeoutSignal: AbortSignal): boolean {
  return timeoutSignal.aborted;
}

function combineSignals(signals: AbortSignal[]): AbortSignal {
  const live = signals.filter(Boolean);
  if (live.length === 1) return live[0] as AbortSignal;
  if (typeof AbortSignal.any === "function") return AbortSignal.any(live);
  const controller = new AbortController();
  for (const s of live) {
    if (s.aborted) {
      controller.abort(s.reason);
      break;
    }
    s.addEventListener("abort", () => controller.abort(s.reason), { once: true });
  }
  return controller.signal;
}

/** リダイレクトを手動で追いながら上流に GET する。返すのは 3xx 以外の最終応答 */
async function fetchFollowingRedirects(
  start: URL,
  ownSuffixes: readonly string[],
  doFetch: typeof fetch,
  signal: AbortSignal,
): Promise<Response> {
  let current = start;
  for (let redirects = 0; ; redirects++) {
    const target = new URL(current);
    target.hash = "";
    const res = await doFetch(target.toString(), {
      method: "GET",
      redirect: "manual",
      // 利用者の Cookie・認証ヘッダー等は一切付けない
      headers: { "User-Agent": UPSTREAM_USER_AGENT, Accept: "image/*" },
      // 取得結果をキャッシュに残さない
      cache: "no-store",
      signal,
    });
    if (!REDIRECT_STATUSES.has(res.status)) return res;

    await res.body?.cancel().catch(() => {});
    if (redirects >= MAX_REDIRECTS) throw new FetchImageFailure("upstream_error");
    const next = resolveRedirect(res.headers.get("location"), current, ownSuffixes);
    if (!next.ok) {
      throw new FetchImageFailure(next.error === "invalid_url" ? "upstream_error" : next.error);
    }
    current = next.url;
  }
}

async function handle(c: Context<{ Bindings: Env }>, options: Required<FetchImageOptions>) {
  const requestUrl = new URL(c.req.url);

  if (!isAllowedCaller(c.req.raw.headers, requestUrl, SITE_ORIGIN)) {
    return errorResponse("forbidden_origin");
  }

  const limiter = c.env?.FETCH_IMAGE_RATE_LIMITER;
  if (limiter) {
    // CF-Connecting-IP は Cloudflare が付ける（利用者は上書きできない）。無いのは開発環境だけ。
    // IPv6 は /64 に丸める（1 契約者が /64 を持つのが普通で、フルアドレスでは送信元を変えるだけで
    // 回避できるため）。本番では WAF のレート制限ルール（IPv6 プレフィックス単位）の併用も検討する
    const key = rateLimitKey(c.req.header("cf-connecting-ip"));
    let allowed: boolean;
    try {
      allowed = (await limiter.limit({ key })).success;
    } catch {
      // 回数制限が効かない状態では中継しない（オープンプロキシ化を避けるため失敗側に倒す）
      return errorResponse("upstream_error");
    }
    if (!allowed) return errorResponse("rate_limited");
  }

  const ownSuffixes = ownHostSuffixes([new URL(SITE_ORIGIN).hostname, requestUrl.hostname]);
  const checked = parseAndCheckUrl(c.req.query("url"), ownSuffixes);
  if (!checked.ok) return errorResponse(checked.error);

  const timeoutSignal = AbortSignal.timeout(options.timeoutMs);
  const signal = combineSignals([timeoutSignal, c.req.raw.signal]);

  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const res = await fetchFollowingRedirects(checked.url, ownSuffixes, options.fetch, signal);
    if (res.status < 200 || res.status >= 300) {
      await res.body?.cancel().catch(() => {});
      throw new FetchImageFailure("upstream_error");
    }
    const upstreamType = mediaType(res.headers.get("content-type"));
    if (!upstreamType.startsWith("image/") || !res.body) {
      await res.body?.cancel().catch(() => {});
      throw new FetchImageFailure("not_image");
    }
    const declared = res.headers.get("content-length");
    if (declared !== null && /^\d+$/.test(declared.trim()) && Number(declared) > options.maxBytes) {
      await res.body.cancel().catch(() => {});
      throw new FetchImageFailure("too_large");
    }

    // 形式の判定に足りるところまでだけ読む（数十バイト、SVG でも最大 1KB 程度）
    reader = res.body.getReader();
    const head: Uint8Array[] = [];
    let total = 0;
    let done = false;
    let format: SniffedFormat | undefined;
    for (;;) {
      const sniff = sniffImage(concat(head, TEXT_SNIFF_BYTES), done);
      if (sniff.kind === "match") {
        format = sniff.format;
        break;
      }
      if (sniff.kind === "no_match") break;
      // 安全弁：判定器の実装によらず、判定のために溜めるのは TEXT_SNIFF_BYTES＋1 チャンク程度まで。
      // それだけ読んでも決まらないものは画像として扱わない（Worker 内に溜め込まない）。
      // 大きな 1 チャンク目でも先頭で判定が付けば上で抜けるので、正常な画像は止めない
      if (total > MAX_SNIFF_BUFFER_BYTES) throw new FetchImageFailure("not_image");
      const chunk = await readWithSignal(reader, signal);
      if (chunk.done) {
        done = true;
        continue;
      }
      total += chunk.value.byteLength;
      if (total > options.maxBytes) throw new FetchImageFailure("too_large");
      head.push(chunk.value);
    }
    // SVG はテキストなので、上流も SVG と名乗っているときだけ通す（HTML 等の取り違えを避ける）
    if (!format || (format === "svg" && upstreamType !== "image/svg+xml")) {
      throw new FetchImageFailure("not_image");
    }

    const upstream = reader;
    const maxBytes = options.maxBytes;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of head) controller.enqueue(chunk);
        if (done) controller.close();
      },
      async pull(controller) {
        try {
          const chunk = await readWithSignal(upstream, signal);
          if (chunk.done) {
            controller.close();
            return;
          }
          total += chunk.value.byteLength;
          // Content-Length が無い・偽りの場合もここで数えて打ち切る
          if (total > maxBytes) {
            await upstream.cancel().catch(() => {});
            controller.error(new Error("too_large"));
            return;
          }
          controller.enqueue(chunk.value);
        } catch (error) {
          controller.error(error);
        }
      },
      cancel(reason) {
        return upstream.cancel(reason).catch(() => {});
      },
    });

    const ext = format === "jpeg" ? "jpg" : format;
    return new Response(body, {
      status: 200,
      headers: {
        ...COMMON_HEADERS,
        "Content-Type": FORMAT_CONTENT_TYPES[format],
        "Content-Disposition": `attachment; filename="image.${ext}"`,
      },
    });
  } catch (error) {
    reader?.cancel().catch(() => {});
    if (error instanceof FetchImageFailure) return errorResponse(error.code);
    if (isTimeout(timeoutSignal)) return errorResponse("timeout");
    return errorResponse("upstream_error");
  }
}

/** fetch-image のルート（テストでは options で上流 fetch・時間・サイズの上限を差し替える） */
export function createFetchImageRoute(options: FetchImageOptions = {}) {
  const resolved: Required<FetchImageOptions> = {
    fetch: options.fetch ?? ((input, init) => fetch(input, init)),
    timeoutMs: options.timeoutMs ?? FETCH_TIMEOUT_MS,
    maxBytes: options.maxBytes ?? MAX_IMAGE_BYTES,
  };
  return new Hono<{ Bindings: Env }>().get("/", (c) => handle(c, resolved));
}

export const fetchImageRoute = createFetchImageRoute();
