import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LANGS } from "~/platform/i18n/langs";
import { EXTERNAL_TRANSMISSION_ANCHOR } from "~/platform/legal/paths";
import { findMissingTranslations } from "../../scripts/vite-plugin-site-files";

const SHARED_CONTENT_DIR = path.resolve(import.meta.dirname, "../../app/platform/content");
const APPS_DIR = path.resolve(import.meta.dirname, "../../app/apps");

describe("content（MDX）", () => {
  it("片方の言語にしか無い記事を検出できる", () => {
    const fixture = path.resolve(import.meta.dirname, "../fixtures/content-missing");
    expect(findMissingTranslations(fixture)).toEqual(["en/only-ja.mdx"]);
  });

  it("サイト共通の記事と、各アプリの記事は日英が揃っている", () => {
    expect(findMissingTranslations(SHARED_CONTENT_DIR)).toEqual([]);
    for (const app of readdirSync(APPS_DIR)) {
      const dir = path.join(APPS_DIR, app, "content");
      if (existsSync(dir)) expect(findMissingTranslations(dir), app).toEqual([]);
    }
  });

  it("プライバシーポリシーに外部送信規律の見出し（フッターのリンク先）がある", () => {
    for (const lang of LANGS) {
      expect(readFileSync(path.join(SHARED_CONTENT_DIR, lang, "privacy.mdx"), "utf8")).toContain(
        `<h2 id="${EXTERNAL_TRANSMISSION_ANCHOR}">`,
      );
    }
  });

  it.each(LANGS)("%s の共通規約は frontmatter を持ち、アプリ固有の記載を含まない", (lang) => {
    for (const page of ["privacy", "terms"]) {
      const common = readFileSync(path.join(SHARED_CONTENT_DIR, lang, `${page}.mdx`), "utf8");
      expect(common).toMatch(/export const frontmatter/);
      expect(common).not.toContain("image-adjust:");
    }
  });
});
