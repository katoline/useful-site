import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LANGS } from "~/i18n/langs";
import { EXTERNAL_TRANSMISSION_ANCHOR, GUIDE_SLUGS } from "~/lib/site-routes";
import { findMissingTranslations } from "../../scripts/vite-plugin-site-files";

const CONTENT_DIR = path.resolve(import.meta.dirname, "../../content");
const REQUIRED = [...GUIDE_SLUGS, "about", "privacy", "terms"];

const read = (lang: string, name: string) =>
  readFileSync(path.join(CONTENT_DIR, lang, `${name}.mdx`), "utf8");

describe("content（MDX）", () => {
  it("日英の記事が揃っている（片方の言語にしか無い記事が無い）", () => {
    expect(findMissingTranslations(CONTENT_DIR)).toEqual([]);
    for (const lang of LANGS) {
      const files = readdirSync(path.join(CONTENT_DIR, lang));
      for (const name of REQUIRED) expect(files).toContain(`${name}.mdx`);
    }
  });

  it("片方の言語にしか無い記事を検出できる", () => {
    const fixture = path.resolve(import.meta.dirname, "../fixtures/content-missing");
    expect(findMissingTranslations(fixture)).toEqual(["en/only-ja.mdx"]);
  });

  it.each(LANGS.flatMap((lang) => REQUIRED.map((name) => [lang, name] as const)))(
    "%s/%s.mdx は frontmatter（title・description・日付）を export している",
    (lang, name) => {
      const src = read(lang, name);
      expect(src.startsWith("export const frontmatter = {")).toBe(true);
      expect(src).toMatch(/title: "[^"]+"/);
      expect(src).toMatch(/description:\s*"[^"]+"/);
      expect(src).toMatch(/datePublished: "\d{4}-\d{2}-\d{2}"/);
      expect(src).toMatch(/dateModified: "\d{4}-\d{2}-\d{2}"/);
      // h1 はページ側で出す
      expect(src).not.toMatch(/^# /m);
    },
  );

  it("プライバシーポリシーに外部送信規律の見出し（フッターのリンク先）がある", () => {
    for (const lang of LANGS) {
      expect(read(lang, "privacy")).toContain(`<h2 id="${EXTERNAL_TRANSMISSION_ANCHOR}">`);
    }
  });

  it("ガイドの日本語版は 2000 字以上", () => {
    for (const slug of GUIDE_SLUGS) {
      expect([...read("ja", slug)].length).toBeGreaterThanOrEqual(2000);
    }
  });
});
