import { describe, expect, it } from "vitest";
import {
  dictionaries,
  formatBytes,
  LANGS,
  localizedPath,
  splitLangPath,
  switchLangPath,
  translate,
} from "~/platform/i18n";

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
});

const appDictionaries = import.meta.glob<{ ja?: unknown; en?: unknown }>(
  "../../app/apps/*/i18n/{ja,en}.ts",
  { eager: true },
);
for (const [file, module] of Object.entries(appDictionaries).filter(([file]) =>
  file.endsWith("/ja.ts"),
)) {
  describe(file, () => {
    it("日英のキーと置換変数が一致する", () => {
      const en = appDictionaries[file.replace("/ja.ts", "/en.ts")]?.en;
      expect(leafKeys(en).sort()).toEqual(leafKeys(module.ja).sort());
      function flatten(dict: unknown, prefix = ""): Record<string, string> {
        if (typeof dict === "string") return { [prefix]: dict };
        return Object.assign(
          {},
          ...Object.entries(dict as Record<string, unknown>).map(([key, value]) =>
            flatten(value, prefix ? `${prefix}.${key}` : key),
          ),
        );
      }
      const jaFlat = flatten(module.ja),
        enFlat = flatten(en);
      for (const key of Object.keys(jaFlat)) {
        expect((enFlat[key] ?? "").trim()).not.toBe("");
        expect([...(enFlat[key] ?? "").matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()).toEqual(
          [...(jaFlat[key] ?? "").matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort(),
        );
      }
    });
  });
}
