/**
 * URL 入力：Worker の中継 API（/image-adjust/api/fetch-image）経由で画像を取得し File にする。
 * 悪用対策はサーバー側（worker/routes/fetch-image.ts）で行う。ここでは結果の扱いだけをする。
 */
import { API_BASE_PATH } from "~/apps/image-adjust/lib/config";
import { sanitizeFileName } from "./pipeline/naming";

export type RemoteImageErrorCode =
  | "invalid_url"
  | "forbidden_host"
  | "too_large"
  | "not_image"
  | "timeout"
  | "rate_limited"
  | "upstream_error"
  | "network";

export class RemoteImageError extends Error {
  readonly code: RemoteImageErrorCode;

  constructor(code: RemoteImageErrorCode) {
    super(code);
    this.name = "RemoteImageError";
    this.code = code;
  }
}

/** サーバーの上限と同じ値（worker/routes/fetch-image.ts の MAX_IMAGE_BYTES） */
export const REMOTE_IMAGE_MAX_BYTES = 25 * 1024 * 1024;

/** サーバーが返す Content-Type → 拡張子（サーバーが判定した形式だけ） */
const EXTENSIONS: Record<string, readonly string[]> = {
  "image/png": ["png"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/gif": ["gif"],
  "image/webp": ["webp"],
  "image/svg+xml": ["svg"],
};

const SERVER_CODES = new Set<RemoteImageErrorCode>([
  "invalid_url",
  "forbidden_host",
  "too_large",
  "not_image",
  "timeout",
  "rate_limited",
  "upstream_error",
]);

/**
 * URL のパス末尾からファイル名を作る。無ければ image.<拡張子>。
 * 拡張子が形式と合わなければ形式の拡張子に付け替える（例 photo.php → photo.png）
 */
export function remoteImageFileName(url: string, contentType: string): string {
  const extensions = EXTENSIONS[contentType] ?? ["bin"];
  const ext = extensions[0] ?? "bin";
  let base = "";
  try {
    const last = new URL(url).pathname.split("/").pop() ?? "";
    try {
      base = decodeURIComponent(last);
    } catch {
      base = last;
    }
  } catch {
    base = "";
  }
  base = sanitizeFileName(base).slice(0, 120);
  if (!base) return `image.${ext}`;
  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const current = dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
  if (extensions.includes(current)) return base;
  return `${stem}.${ext}`;
}

async function readErrorCode(res: Response): Promise<RemoteImageErrorCode> {
  try {
    const data = (await res.json()) as { error?: unknown };
    const code = data?.error;
    if (typeof code === "string" && SERVER_CODES.has(code as RemoteImageErrorCode)) {
      return code as RemoteImageErrorCode;
    }
  } catch {
    // JSON でない（プロキシ等のエラーページ）
  }
  if (res.status === 429) return "rate_limited";
  if (res.status === 413) return "too_large";
  // forbidden_origin・not_found 等、利用者が対処できないものはまとめる
  return "upstream_error";
}

/** ボディを上限付きで読む。途中で切れたら、上限付近まで届いていれば too_large とみなす */
async function readBody(res: Response, signal?: AbortSignal): Promise<Blob> {
  if (!res.body) return res.blob();
  const reader = res.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let received = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > REMOTE_IMAGE_MAX_BYTES) {
        await reader.cancel().catch(() => {});
        throw new RemoteImageError("too_large");
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof RemoteImageError) throw error;
    if (signal?.aborted) throw signal.reason ?? error;
    // サーバーはサイズ超過・時間切れをヘッダー送信後に検出すると接続を切るしかない。
    // 上限付近まで届いていたらサイズ超過、それ以外は通信エラーとして扱う
    if (received >= REMOTE_IMAGE_MAX_BYTES - 1024 * 1024) throw new RemoteImageError("too_large");
    throw new RemoteImageError("network");
  }
  return new Blob(chunks);
}

/**
 * 画像 URL を中継 API で取得して File にする。
 * 失敗は RemoteImageError（code で種類を判別）。signal で中断した場合は中断の例外（AbortError 等）を
 * そのまま投げる（RemoteImageError にはしない）。
 */
export async function fetchRemoteImage(url: string, signal?: AbortSignal): Promise<File> {
  const trimmed = url.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new RemoteImageError("invalid_url");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new RemoteImageError("invalid_url");
  }

  const endpoint = `${API_BASE_PATH}/fetch-image?url=${encodeURIComponent(trimmed)}`;
  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw signal.reason ?? error;
    throw new RemoteImageError("network");
  }

  if (!res.ok) throw new RemoteImageError(await readErrorCode(res));

  const contentType = (res.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase();
  if (!contentType || !(contentType in EXTENSIONS)) {
    await res.body?.cancel().catch(() => {});
    throw new RemoteImageError("not_image");
  }

  const blob = await readBody(res, signal);
  return new File([blob], remoteImageFileName(trimmed, contentType), { type: contentType });
}
