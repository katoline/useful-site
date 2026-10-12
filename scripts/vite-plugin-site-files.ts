/**
 * ルート定義から作るサイトのファイル（マニフェスト・sitemap）を出す Vite プラグイン。
 *
 * - ビルド：client 環境の generateBundle で build/client/ 直下に書き出す（postbuild が
 *   build/client/image-adjust/ に移す。public/ の中身と同じ扱い）
 * - dev：同じ URL（/image-adjust/manifest.ja.webmanifest 等）で返す
 * - content/<lang>/*.mdx が片方の言語にしか無ければ警告する（plan.md §9.3）
 */
import { readdirSync } from "node:fs";
import path from "node:path";
import type { Logger, Plugin } from "vite";
import { LANGS } from "../app/i18n/langs.ts";
import { BASE_PATH, DEFAULT_SITE_ORIGIN, normalizeSiteOrigin } from "../app/lib/config.ts";
import { buildSitemap } from "../app/lib/sitemap.ts";
import { buildWebManifestFiles } from "../app/lib/web-manifest.ts";
import { checkDeployOrigin } from "./lib/site-origin.ts";

const CONTENT_DIR = path.resolve(import.meta.dirname, "../content");

/** 片方の言語にしか無い記事（"en/foo.mdx が無い" 等）の一覧 */
export function findMissingTranslations(contentDir = CONTENT_DIR): string[] {
  const byLang = new Map(
    LANGS.map((lang) => {
      let files: string[] = [];
      try {
        files = readdirSync(path.join(contentDir, lang)).filter((f) => f.endsWith(".mdx"));
      } catch {
        files = [];
      }
      return [lang, new Set(files)] as const;
    }),
  );
  const all = new Set([...byLang.values()].flatMap((s) => [...s]));
  const missing: string[] = [];
  for (const file of [...all].sort()) {
    for (const lang of LANGS) {
      if (!byLang.get(lang)?.has(file)) missing.push(`${lang}/${file}`);
    }
  }
  return missing;
}

export function siteFilesPlugin(): Plugin {
  let origin = DEFAULT_SITE_ORIGIN;
  let envOrigin: string | undefined;
  let logger: Logger | undefined;
  const files = (): Record<string, string> => ({
    ...buildWebManifestFiles(),
    "sitemap.xml": buildSitemap(origin),
  });
  const contentType = (name: string) =>
    name.endsWith(".xml") ? "application/xml; charset=utf-8" : "application/manifest+json";

  return {
    name: "image-adjust:site-files",
    // dev で React Router のミドルウェア（未知のパスを 404 ページにする）より先に返す
    enforce: "pre",
    configResolved(config) {
      const fromEnv = config.env.VITE_SITE_ORIGIN as string | undefined;
      // app/lib/config.ts の SITE_ORIGIN と同じく正規化する（sitemap と canonical を揃える）
      origin = normalizeSiteOrigin(fromEnv) ?? DEFAULT_SITE_ORIGIN;
      logger = config.logger;
      envOrigin = fromEnv;
    },
    buildStart() {
      if (this.environment?.name !== "client") return;
      // 本番ビルドで公開に使えないオリジン（example 等の仮の値・https 以外・パス付き）なら目立たせる。
      // 未設定なら既定値（暫定ドメイン）を確かめるので、既定値のままなら出ない。検証用のビルドは通すので
      // 止めはしない（公開は `pnpm run deploy` が scripts/check-deploy-env.ts で同じ判定をして止める）。
      // configResolved では出さない（react-router typegen でも呼ばれるため）
      const error =
        this.environment.config.command === "build" ? checkDeployOrigin(envOrigin) : null;
      if (error) {
        logger?.warn(
          [
            "",
            `\x1b[33m${"=".repeat(72)}`,
            ` 警告：${error}`,
            ` canonical・hreflang・og:url・sitemap.xml が ${origin} を指します。`,
            " 公開用のビルドでは VITE_SITE_ORIGIN を正しく設定してください（.env.example を参照）",
            `${"=".repeat(72)}\x1b[0m`,
            "",
          ].join("\n"),
        );
      }
      for (const missing of findMissingTranslations()) {
        this.warn(`content/${missing} がありません（片方の言語にしか無い記事）`);
      }
    },
    generateBundle() {
      if (this.environment?.name !== "client") return;
      for (const [fileName, source] of Object.entries(files())) {
        this.emitFile({ type: "asset", fileName, source });
      }
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = (req.url ?? "").split("?")[0] ?? "";
        const name = pathname.startsWith(`${BASE_PATH}/`)
          ? pathname.slice(BASE_PATH.length + 1)
          : pathname.replace(/^\//, "");
        const body = files()[name];
        if (body === undefined) return next();
        res.setHeader("content-type", contentType(name));
        res.end(body);
      });
    },
  };
}
