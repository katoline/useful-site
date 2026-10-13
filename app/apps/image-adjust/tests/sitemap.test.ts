import { describe, expect, it } from "vitest";
import { localizedPath } from "~/apps/image-adjust/i18n/langs";
import { BASE_PATH } from "~/apps/image-adjust/shared/config";
import { allPagePaths } from "~/apps/image-adjust/shared/site-routes";
import { LANGS } from "~/platform/i18n/langs";
import { buildSitemap } from "~/platform/seo/sitemap";

const ORIGIN = "https://example.com";

function urls(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1] ?? "");
}

describe("sitemap", () => {
  const xml = buildSitemap(ORIGIN, [
    { appPath: "image-adjust", pages: allPagePaths() },
    { appPath: "", pages: [""] },
  ]);

  it("全ページを日英の両方で含む（末尾スラッシュ付きの絶対 URL）", () => {
    const expected = allPagePaths().flatMap((page) =>
      LANGS.map((lang) => `${ORIGIN}${localizedPath(lang, page)}`),
    );
    expected.push(`${ORIGIN}/`, `${ORIGIN}/en/`);
    expect(urls(xml).sort()).toEqual([...expected].sort());
    for (const url of urls(xml)) expect(url).toMatch(/\/$/);
  });

  it("各 URL に ja / en / x-default の hreflang 相互リンクがある", () => {
    const blocks = xml.split("<url>").slice(1);
    expect(blocks).toHaveLength((allPagePaths().length + 1) * LANGS.length);
    for (const block of blocks) {
      for (const hreflang of [...LANGS, "x-default"]) {
        expect(block).toContain(`hreflang="${hreflang}"`);
      }
    }
    expect(xml).toContain(
      `<xhtml:link rel="alternate" hreflang="en" href="${ORIGIN}${BASE_PATH}/en/guide/image-formats/"/>`,
    );
    expect(xml).toContain(
      `<xhtml:link rel="alternate" hreflang="x-default" href="${ORIGIN}${BASE_PATH}/guide/image-formats/"/>`,
    );
  });

  it("XML として正しい名前空間を持つ", () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
  });
});
