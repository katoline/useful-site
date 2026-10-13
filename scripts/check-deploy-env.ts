/**
 * デプロイ前の確認（`pnpm run deploy` の最初に実行する。`pnpm deploy` は pnpm 組み込みのコマンドなので別物）。
 * 公開するオリジンが仮の値（example ドメイン等）・https 以外・パス付き、または wrangler.jsonc の routes のホストと
 * 一致しないなら、ビルドもデプロイもせずに止める。
 * VITE_SITE_ORIGIN が未設定なら app/platform/config/index.ts の DEFAULT_SITE_ORIGIN（暫定ドメイン）で公開するので、それを確かめる。
 * 値は Vite と同じく環境変数と .env 類（mode: production）から読む。
 */
import path from "node:path";
import { loadEnv } from "vite";
import { unstable_readConfig } from "wrangler";
import { DEFAULT_SITE_ORIGIN, normalizeSiteOrigin } from "../app/platform/config/index.ts";
import { checkDeployOrigin, checkOriginMatchesRoutes } from "./lib/site-origin.ts";

const root = path.resolve(import.meta.dirname, "..");
const env = loadEnv("production", root, "VITE_");
// ビルドでも app/platform/config/index.ts が同じく正規化した値（URL#origin）を使う
const fromEnv = normalizeSiteOrigin(env.VITE_SITE_ORIGIN);
const origin = fromEnv ?? DEFAULT_SITE_ORIGIN;
// 公開オリジンのホストが、Worker を配信するホスト（wrangler.jsonc の routes）とずれていないか
const wrangler = unstable_readConfig({ config: path.join(root, "wrangler.jsonc") });
const error =
  checkDeployOrigin(env.VITE_SITE_ORIGIN) ??
  checkOriginMatchesRoutes(origin, wrangler.routes, wrangler.workers_dev);

if (error) {
  console.error(`\n[deploy] 中止しました: ${error}`);
  console.error(
    "[deploy] 公開するオリジン（app/platform/config/index.ts の DEFAULT_SITE_ORIGIN、一時的な上書きは VITE_SITE_ORIGIN）と wrangler.jsonc の routes を確認してください（.env.example を参照）\n",
  );
  process.exit(1);
}
console.log(
  fromEnv
    ? `[deploy] SITE_ORIGIN=${fromEnv}（VITE_SITE_ORIGIN）`
    : `[deploy] SITE_ORIGIN=${DEFAULT_SITE_ORIGIN}（VITE_SITE_ORIGIN が未設定のため既定値）`,
);
