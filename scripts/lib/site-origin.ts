/**
 * 公開時の SITE_ORIGIN の確認（canonical・hreflang・og:url・sitemap が仮のドメインや形の誤った値を指したまま
 * 公開しないため）。VITE_SITE_ORIGIN が未設定なら app/lib/config.ts の DEFAULT_SITE_ORIGIN（暫定ドメイン）を
 * 確かめる。Node で直接実行するスクリプトからも読むので、import 先は他を import しないファイルに限る。
 */
import { DEFAULT_SITE_ORIGIN } from "../../app/lib/config.ts";

/** 仮のオリジン（example ドメイン等）か */
export function isPlaceholderOrigin(origin: string): boolean {
  let url: URL;
  try {
    url = new URL(origin.trim());
  } catch {
    return false;
  }
  const host = url.hostname;
  // example.com 等（RFC 2606）と、その下のサブドメイン、*.example.* の形
  return /(^|\.)example(\.(com|net|org))?$/.test(host) || /(^|\.)example\./.test(host);
}

/**
 * デプロイしてよいオリジンかを確かめる。問題があればその理由（日本語）を返し、無ければ null。
 * value（VITE_SITE_ORIGIN）が未設定・空なら fallback（既定値）を確かめる。
 * 求める形は「https://ホスト名[:ポート]」（末尾スラッシュは可。パス・クエリ・ハッシュ・認証情報なし）
 */
export function checkDeployOrigin(
  value: string | undefined,
  fallback: string = DEFAULT_SITE_ORIGIN,
): string | null {
  const fromEnv = value?.trim();
  const origin = fromEnv || fallback.trim();
  const label = fromEnv
    ? "VITE_SITE_ORIGIN"
    : "VITE_SITE_ORIGIN が未設定のため使う既定値（DEFAULT_SITE_ORIGIN）";
  if (!origin) {
    return "VITE_SITE_ORIGIN も既定値も空です（例 VITE_SITE_ORIGIN=https://<公開するドメイン>）";
  }
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return `${label}が URL として読めません: ${origin}`;
  }
  if (url.protocol !== "https:") {
    return `${label}は https にしてください: ${origin}`;
  }
  // 文字列ではなく URL の構造で見る（大文字のホスト・既定のポート・国際化ドメインは正しいオリジン）
  if (url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
    return `${label}はオリジンだけ（パス・クエリ・認証情報なし）にしてください: ${origin}`;
  }
  // 以降は正規化した値（小文字・既定ポートなし・punycode）で判定する
  if (isPlaceholderOrigin(url.origin)) {
    return `${label}が仮の値のままです: ${origin}`;
  }
  return null;
}

/** wrangler の routes の 1 件（文字列か、pattern を持つオブジェクト） */
export type WranglerRoute = string | { pattern: string };

/** ルートの pattern からホスト部を取り出す（"https://" は外し、最初の "/" まで。小文字） */
export function routeHost(route: WranglerRoute): string {
  const pattern = typeof route === "string" ? route : route.pattern;
  return (
    pattern
      .trim()
      .replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
      .split("/")[0] ?? ""
  ).toLowerCase();
}

/** ホストがルートのホスト部（"*" はワイルドカード。例 "*.example.com"）に一致するか */
function hostMatches(host: string, pattern: string): boolean {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`).test(host);
}

/**
 * 公開オリジンのホストが、Worker を配信するホスト（wrangler.jsonc の routes）と一致するかを確かめる。
 * 一致しなければ canonical・hreflang・og:url・sitemap が配信していないホストを指すので、その理由を返す。
 * - routes があれば、どれかのホスト部と一致すること（workers_dev が有効なら *.workers.dev も可）
 * - routes が無ければ workers.dev だけで配信するので、workers_dev が有効で、オリジンが *.workers.dev であること
 *   （wrangler は routes が無いと workers_dev の既定値を true にする）
 */
export function checkOriginMatchesRoutes(
  origin: string,
  routes: readonly WranglerRoute[] | undefined,
  workersDev: boolean | undefined,
): string | null {
  let host: string;
  try {
    host = new URL(origin.trim()).hostname;
  } catch {
    return `公開オリジンが URL として読めません: ${origin}`;
  }
  const hosts = (routes ?? []).map(routeHost).filter(Boolean);
  const workersDevEnabled = workersDev ?? hosts.length === 0;
  if (workersDevEnabled && host.endsWith(".workers.dev")) return null;
  if (hosts.length === 0) {
    return workersDevEnabled
      ? `wrangler.jsonc に routes が無く workers.dev だけで配信しますが、公開オリジンのホスト（${host}）が *.workers.dev ではありません`
      : "wrangler.jsonc に routes が無く workers_dev も無効なので、どのホストでも配信されません";
  }
  if (hosts.some((pattern) => hostMatches(host, pattern))) return null;
  return `公開オリジンのホスト（${host}）が wrangler.jsonc の routes のホスト（${[...new Set(hosts)].join(", ")}）のどれとも一致しません。DEFAULT_SITE_ORIGIN・VITE_SITE_ORIGIN と routes をそろえてください`;
}
