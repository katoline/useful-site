/**
 * サイト全体の設定値。BASE_PATH と SITE_ORIGIN はここだけで定義する。
 * vite.config.ts / react-router.config.ts / worker からも import する。
 */

/** サブパスの接頭辞（末尾スラッシュなし）。他の場所に直書きしない */
export const BASE_PATH = "";

/**
 * canonical・OGP・hreflang・sitemap に使う公開オリジン（暫定ドメイン。plan.md §4）。
 * ビルド時に VITE_SITE_ORIGIN で上書きできる。ドメインを変えるときは、ここと wrangler.jsonc の routes を変える
 */
export const DEFAULT_SITE_ORIGIN = "https://t0n03k1.com";

/**
 * VITE_SITE_ORIGIN の値をオリジンに正規化する（大文字のホスト・既定のポート・国際化ドメイン →
 * URL#origin。canonical 等にそのまま入れない）。sitemap を作る Vite プラグインも使う。
 * URL として読めない値は、間違いに気づけるようそのまま使う（公開前は scripts/check-deploy-env.ts が止める）
 */
export function normalizeSiteOrigin(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  try {
    return new URL(trimmed).origin;
  } catch {
    return trimmed.replace(/\/+$/, "");
  }
}

function readEnvOrigin(): string | undefined {
  // Node（vite.config 読み込み時）では import.meta.env が無いので任意参照にする
  const env = (import.meta as { env?: Record<string, string | undefined> }).env;
  return normalizeSiteOrigin(env?.VITE_SITE_ORIGIN);
}

export const SITE_ORIGIN: string = readEnvOrigin() ?? DEFAULT_SITE_ORIGIN;

export const STORAGE_PREFIX = "site:";
export const SITE_NAME = { ja: "便利ツール集", en: "Handy Tools" } as const;
export function absoluteUrl(path: string): string {
  return `${SITE_ORIGIN}/${path.replace(/^\/+/, "")}`;
}
export function absoluteAssetUrl(file: string): string {
  return absoluteUrl(file);
}
