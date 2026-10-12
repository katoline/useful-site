import { describe, expect, it } from "vitest";
import {
  dictionaries,
  formatBytes,
  LANGS,
  localizedPath,
  splitLangPath,
  switchLangPath,
  translate,
} from "~/i18n";
import { allBuildPaths, allPagePaths, allPrerenderPaths } from "~/lib/site-routes";

/** 辞書の葉のキーを列挙する */
function leafKeys(obj: unknown, prefix = ""): string[] {
  if (typeof obj === "string") return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    leafKeys(v, prefix ? `${prefix}.${k}` : k),
  );
}

describe("辞書", () => {
  it("日英でキーが一致し、空の訳が無い", () => {
    const jaKeys = leafKeys(dictionaries.ja).sort();
    for (const lang of LANGS) {
      expect(leafKeys(dictionaries[lang]).sort()).toEqual(jaKeys);
      for (const key of jaKeys) {
        expect(translate(lang, key as never).trim(), `${lang}:${key}`).not.toBe("");
      }
    }
  });

  it("置換変数が日英で同じ", () => {
    const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const key of leafKeys(dictionaries.ja)) {
      expect(vars(translate("en", key as never)), key).toEqual(vars(translate("ja", key as never)));
    }
  });

  it("t() は変数を埋める", () => {
    expect(translate("ja", "pages.convert.title", { from: "PNG", to: "WebP" })).toBe(
      "PNG を WebP に変換",
    );
    expect(translate("en", "pages.convert.title", { from: "PNG", to: "WebP" })).toBe(
      "Convert PNG to WebP",
    );
  });

  it("バイト数を言語に合わせて表示する", () => {
    expect(formatBytes("ja", 1000 * 1024)).toBe("1,000 KB");
    expect(formatBytes("en", 1.5 * 1024 * 1024)).toBe("1.5 MB");
    expect(formatBytes("en", 512)).toBe("512 B");
  });
});

describe("URL と言語", () => {
  it("ja は接頭辞なし、en は /en", () => {
    expect(localizedPath("ja", "")).toBe("/");
    expect(localizedPath("en", "")).toBe("/en/");
    expect(localizedPath("ja", "convert/png-to-webp")).toBe("/convert/png-to-webp/");
    expect(localizedPath("en", "icons")).toBe("/en/icons/");
  });

  it("pathname から言語とページを取り出す", () => {
    expect(splitLangPath("/")).toEqual({ lang: "ja", page: "" });
    expect(splitLangPath("/en")).toEqual({ lang: "en", page: "" });
    expect(splitLangPath("/en/guide/image-formats/")).toEqual({
      lang: "en",
      page: "guide/image-formats",
    });
    expect(splitLangPath("/about")).toEqual({ lang: "ja", page: "about" });
  });

  it("同じページの他言語版へ切り替える", () => {
    expect(switchLangPath("/compress/jpeg/", "en")).toBe("/en/compress/jpeg/");
    expect(switchLangPath("/en/compress/jpeg/", "ja")).toBe("/compress/jpeg/");
    expect(switchLangPath("/en/", "ja")).toBe("/");
  });

  it("prerender 対象は全ページ × 全言語で、末尾スラッシュなし", () => {
    const paths = allPrerenderPaths();
    expect(paths).toHaveLength(allPagePaths().length * LANGS.length);
    expect(paths).toContain("/");
    expect(paths).toContain("/en");
    expect(paths).toContain("/en/convert/webp-to-jpeg");
    expect(paths).toContain("/compress/svg");
    expect(paths.filter((p) => p !== "/" && p.endsWith("/"))).toEqual([]);
    expect(allBuildPaths()).toEqual(expect.arrayContaining(["/404", "/en/404"]));
  });
});
