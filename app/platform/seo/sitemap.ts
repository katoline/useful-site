import { DEFAULT_LANG, LANGS, type Lang } from "../i18n/langs.ts";
import { createAppPaths } from "../paths/app-paths.ts";
export interface SitemapApp {
  appPath: string;
  pages: readonly string[];
}
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\x27/g, "&apos;");
}
export function sitemapUrl(origin: string, appPath: string, lang: Lang, page: string): string {
  return `${origin.replace(/\/+$/, "")}${createAppPaths(appPath).localizedPath(lang, page)}`;
}
export function buildSitemap(origin: string, apps: readonly SitemapApp[]): string {
  const entries = apps.flatMap(({ appPath, pages }) =>
    pages.flatMap((page) => {
      const alternates = [
        ...LANGS.map((lang) => ({ hreflang: lang, href: sitemapUrl(origin, appPath, lang, page) })),
        { hreflang: "x-default", href: sitemapUrl(origin, appPath, DEFAULT_LANG, page) },
      ];
      const links = alternates
        .map(
          (a) =>
            `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${escapeXml(a.href)}"/>`,
        )
        .join("\n");
      return LANGS.map(
        (lang) =>
          `  <url>\n    <loc>${escapeXml(sitemapUrl(origin, appPath, lang, page))}</loc>\n${links}\n  </url>`,
      );
    }),
  );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entries,
    "</urlset>",
    "",
  ].join("\n");
}
