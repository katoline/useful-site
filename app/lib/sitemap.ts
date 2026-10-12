/**
 * /image-adjust/sitemap.xml の生成（plan.md §3.7）。ページ一覧は site-routes.ts の allPagePaths()。
 * 各 URL に hreflang（ja / en / x-default=日本語版）の相互リンクを付ける。URL は末尾スラッシュ付き。
 * vite.config.ts のプラグインがビルド時に書き出す（オリジンは VITE_SITE_ORIGIN を反映して渡す）。
 */
import { DEFAULT_LANG, LANGS, localizedPath } from "../i18n/langs.ts";
import { withBase } from "./config.ts";
import { allPagePaths } from "./site-routes.ts";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function sitemapUrl(origin: string, lang: (typeof LANGS)[number], page: string): string {
  return `${origin.replace(/\/+$/, "")}${withBase(localizedPath(lang, page))}`;
}

export function buildSitemap(origin: string, pages: string[] = allPagePaths()): string {
  const entries = pages.flatMap((page) => {
    const alternates = [
      ...LANGS.map((l) => ({ hreflang: l, href: sitemapUrl(origin, l, page) })),
      { hreflang: "x-default", href: sitemapUrl(origin, DEFAULT_LANG, page) },
    ];
    const links = alternates
      .map(
        (a) =>
          `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${escapeXml(a.href)}"/>`,
      )
      .join("\n");
    return LANGS.map(
      (lang) =>
        `  <url>\n    <loc>${escapeXml(sitemapUrl(origin, lang, page))}</loc>\n${links}\n  </url>`,
    );
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entries,
    "</urlset>",
    "",
  ].join("\n");
}
