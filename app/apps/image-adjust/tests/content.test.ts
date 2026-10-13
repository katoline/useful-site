import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GUIDE_SLUGS } from "~/apps/image-adjust/domain/pages";
import { LANGS } from "~/platform/i18n/langs";
import { findMissingTranslations } from "../../../../scripts/vite-plugin-site-files";

const CONTENT_DIR = path.resolve(import.meta.dirname, "../content");
const LEGAL_DIR = path.resolve(import.meta.dirname, "../legal");
const REQUIRED = [...GUIDE_SLUGS, "about"];

const read = (lang: string, name: string) =>
  readFileSync(path.join(CONTENT_DIR, lang, `${name}.mdx`), "utf8");

describe("Image Adjust の content（MDX）", () => {
  it("日英の記事が揃っている（片方の言語にしか無い記事が無い）", () => {
    expect(findMissingTranslations(CONTENT_DIR)).toEqual([]);
    for (const lang of LANGS) {
      const files = readdirSync(path.join(CONTENT_DIR, lang));
      for (const name of REQUIRED) expect(files).toContain(`${name}.mdx`);
    }
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

  it.each(LANGS)("%s の規約類に差し込む Image Adjust 固有の節が揃っている", (lang) => {
    for (const page of ["privacy", "terms"]) {
      const specific = readFileSync(path.join(LEGAL_DIR, `${page}.${lang}.mdx`), "utf8");
      expect(specific).toContain(lang === "ja" ? "画像" : "image");
      expect(specific).toMatch(lang === "ja" ? /回数制限/ : /rate limit/i);
      if (page === "privacy") {
        expect(specific).toContain("Service Worker");
        expect(specific).toContain("Cloudflare");
      }
    }
  });

  it("ガイドの日本語版は 2000 字以上", () => {
    for (const slug of GUIDE_SLUGS) {
      expect([...read("ja", slug)].length).toBeGreaterThanOrEqual(2000);
    }
  });
});
