/**
 * サイト全体の設定値。BASE_PATH と SITE_ORIGIN はここだけで定義する。
 * vite.config.ts / react-router.config.ts / worker からも import する。
 */

/** サブパスの接頭辞（末尾スラッシュなし）。他の場所に直書きしない */
export const BASE_PATH = "/image-adjust";

/** canonical・OGP・hreflang に使うオリジン。ビルド時に VITE_SITE_ORIGIN で上書きできる */
export const DEFAULT_SITE_ORIGIN = "https://image-adjust.example.workers.dev";

function readEnvOrigin(): string | undefined {
  // Node（vite.config 読み込み時）では import.meta.env が無いので任意参照にする
  const env = (import.meta as { env?: Record<string, string | undefined> }).env;
  const value = env?.VITE_SITE_ORIGIN;
  return value ? value.replace(/\/+$/, "") : undefined;
}

export const SITE_ORIGIN: string = readEnvOrigin() ?? DEFAULT_SITE_ORIGIN;

/** localStorage・Cache Storage 等のキー接頭辞（ドメイン内の他アプリと衝突させない） */
export const STORAGE_PREFIX = "image-adjust:";

/** Hono の API の基点 */
export const API_BASE_PATH = `${BASE_PATH}/api`;

/** サイト名（ロゴ文字）。未決事項なので仮 */
export const SITE_NAME = "Image Adjust";

/**
 * BASE_PATH からの相対パスを、サイト内の絶対パス（/image-adjust/...）にする。
 * 末尾スラッシュはディレクトリ形式に統一する（例 "/about" → "/image-adjust/about/"）。
 */
export function withBase(path: string): string {
  const trimmed = path.replace(/^\/+|\/+$/g, "");
  return trimmed ? `${BASE_PATH}/${trimmed}/` : `${BASE_PATH}/`;
}

/** 絶対 URL（canonical 等）にする */
export function absoluteUrl(path: string): string {
  return `${SITE_ORIGIN}${withBase(path)}`;
}

/** 静的ファイル（画像等）の絶対 URL。末尾スラッシュを付けない（例 "og/ja.png"） */
export function absoluteAssetUrl(file: string): string {
  return `${SITE_ORIGIN}${BASE_PATH}/${file.replace(/^\/+/, "")}`;
}
