// @vitest-environment happy-dom
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { STORAGE_KEYS, storageKey } from "~/platform/storage";
import { THEME_COLORS, THEME_INIT_SCRIPT } from "~/platform/theme/theme";

describe("描画前のテーマ初期化", () => {
  it.each([
    { saved: "light", dark: true, expected: "light" },
    { saved: "dark", dark: false, expected: "dark" },
    { saved: "system", dark: true, expected: "dark" },
    { saved: null, dark: false, expected: "light" },
    { saved: "</script><script>alert(1)</script>", dark: true, expected: "dark" },
  ] as const)("保存値 $saved / 端末dark=$dark → $expected", ({ saved, dark, expected }) => {
    const doc = new DOMParser().parseFromString(
      '<html><head><meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff">' +
        '<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0a0a0a"></head></html>',
      "text/html",
    );
    const context = {
      document: doc,
      localStorage: {
        getItem(key: string) {
          expect(key).toBe(storageKey(STORAGE_KEYS.theme));
          return saved;
        },
      },
      window: { matchMedia: () => ({ matches: dark }) },
    };
    runInNewContext(THEME_INIT_SCRIPT, context);
    doc.dispatchEvent(new Event("DOMContentLoaded"));
    expect(doc.documentElement.getAttribute("data-theme")).toBe(expected);
    expect(doc.documentElement.style.colorScheme).toBe(expected);
    const colors = [...doc.querySelectorAll('meta[name="theme-color"]')].map((meta) =>
      meta.getAttribute("content"),
    );
    expect(colors).toEqual(
      saved === "light" || saved === "dark"
        ? [THEME_COLORS[expected], THEME_COLORS[expected]]
        : [THEME_COLORS.light, THEME_COLORS.dark],
    );
  });
});
