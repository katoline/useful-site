/**
 * Cloudflare Web Analytics（Cookie を使わないアクセス解析。plan.md §7.5）。
 * ビルド時の環境変数 VITE_CF_ANALYTICS_TOKEN があるときだけビーコンを読み込む。
 * 許可ドメインは scripts/lib/csp.ts の CSP に入れてある。
 */
const TOKEN = import.meta.env.VITE_CF_ANALYTICS_TOKEN;

export function CloudflareAnalytics() {
  if (!TOKEN) return null;
  return (
    <script
      defer
      src="https://static.cloudflareinsights.com/beacon.min.js"
      data-cf-beacon={JSON.stringify({ token: TOKEN })}
    />
  );
}
