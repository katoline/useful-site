/**
 * ルート定義から作るサイトのファイル（マニフェスト・sitemap・robots.txt・ads.txt）を出す Vite プラグイン。
 *
 * - ビルド：client 環境の generateBundle で配信 URL と同じパスに書き出す
 * - dev：同じ URL（/image-adjust/manifest.ja.webmanifest 等）で返す
 * - content/<lang>/*.mdx が片方の言語にしか無ければ警告する（plan.md §9.3）
 */
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import type { Logger, Plugin } from "vite";
import { DEFAULT_SITE_ORIGIN, normalizeSiteOrigin } from "../app/platform/config/index.ts";
import { LANGS } from "../app/platform/i18n/langs.ts";
import { SITE_LEGAL_PAGES } from "../app/platform/legal/paths.ts";
import { buildSitemap } from "../app/platform/seo/sitemap.ts";
import { buildAdsTxt } from "./lib/ads-txt.ts";
import { collectAppRoutes } from "./lib/app-routes.ts";
import { checkDeployOrigin } from "./lib/site-origin.ts";

/** 片方の言語にしか無い記事（"en/foo.mdx が無い" 等）の一覧 */
export function findMissingTranslations(contentDir: string): string[] {
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
  let adsenseClient: string | undefined;
  let logger: Logger | undefined;
  let generatedFiles: Record<string, string> = {};
  const files = () => generatedFiles;
  async function refreshFiles() {
    const apps = await collectAppRoutes();
    generatedFiles = {};
    const sitePages = [
      ...apps.filter((app) => !app.appPath).flatMap((app) => app.allPagePaths()),
      ...SITE_LEGAL_PAGES,
    ];
    generatedFiles["sitemaps/site.xml"] = buildSitemap(origin, [{ appPath: "", pages: sitePages }]);
    const sitemapNames = ["sitemaps/site.xml"];
    const appsDir = path.resolve(import.meta.dirname, "../app/apps");
    for (const entry of readdirSync(appsDir, { withFileTypes: true })) {
      const file = path.join(appsDir, entry.name, "site-files.ts");
      if (!entry.isDirectory()) continue;
      const { manifest } = (await import(path.join(appsDir, entry.name, "manifest.ts"))) as {
        manifest: { path: string; status: string };
      };
      const app = apps.find((item) => item.appPath === manifest.path);
      if (manifest.path && manifest.status !== "hidden" && app) {
        const sitemapName = `${manifest.path}/sitemap.xml`;
        sitemapNames.push(sitemapName);
        generatedFiles[sitemapName] = buildSitemap(origin, [
          { appPath: manifest.path, pages: app.allPagePaths() },
        ]);
      }
      if (!existsSync(file)) continue;
      const module = (await import(file)) as { buildSiteFiles(): Record<string, string> };
      for (const [name, source] of Object.entries(module.buildSiteFiles()))
        generatedFiles[[manifest.path, name].filter(Boolean).join("/")] = source;
    }
    generatedFiles["sitemap.xml"] = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...sitemapNames.map((name) => `  <sitemap><loc>${origin}/${name}</loc></sitemap>`),
      "</sitemapindex>",
      "",
    ].join("\n");
    generatedFiles["robots.txt"] = `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`;
    // AdSense の ID が設定されているときだけ出す（未設定・形式違いなら出さない）
    const adsTxt = buildAdsTxt(adsenseClient);
    if (adsTxt.kind === "ok") generatedFiles["ads.txt"] = adsTxt.body;
    if (adsTxt.kind === "invalid") {
      logger?.warn(
        `警告：VITE_ADSENSE_CLIENT（${adsTxt.value}）が ca-pub-<数字> の形式ではないので、ads.txt を出しません`,
      );
    }
  }
  const contentType = (name: string) =>
    name.endsWith(".xml")
      ? "application/xml; charset=utf-8"
      : name.endsWith(".txt")
        ? "text/plain; charset=utf-8"
        : "application/manifest+json";

  return {
    name: "useful-site:site-files",
    // dev で React Router のミドルウェア（未知のパスを 404 ページにする）より先に返す
    enforce: "pre",
    configResolved(config) {
      const fromEnv = config.env.VITE_SITE_ORIGIN as string | undefined;
      // app/platform/config/index.ts の SITE_ORIGIN と同じく正規化する（sitemap と canonical を揃える）
      origin = normalizeSiteOrigin(fromEnv) ?? DEFAULT_SITE_ORIGIN;
      logger = config.logger;
      envOrigin = fromEnv;
      adsenseClient = config.env.VITE_ADSENSE_CLIENT as string | undefined;
    },
    async buildStart() {
      if (this.environment?.name !== "client") return;
      await refreshFiles();
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
      const appsDir = path.resolve(import.meta.dirname, "../app/apps");
      for (const app of readdirSync(appsDir, { withFileTypes: true })) {
        if (!app.isDirectory()) continue;
        const content = path.join(appsDir, app.name, "content");
        if (!existsSync(content)) continue;
        for (const missing of findMissingTranslations(content))
          this.warn(`${app.name}/content/${missing} がありません（片方の言語にしか無い記事）`);
      }
    },
    generateBundle() {
      if (this.environment?.name !== "client") return;
      for (const [fileName, source] of Object.entries(files())) {
        this.emitFile({ type: "asset", fileName, source });
      }
    },
    async configureServer(server) {
      await refreshFiles();
      server.middlewares.use((req, res, next) => {
        const pathname = (req.url ?? "").split("?")[0] ?? "";
        const name = pathname.replace(/^\//, "");
        const body = files()[name];
        if (body === undefined) return next();
        res.setHeader("content-type", contentType(name));
        res.end(body);
      });
    },
  };
}
