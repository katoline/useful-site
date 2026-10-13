import { describe, expect, it } from "vitest";
import { translate } from "~/apps/image-adjust/i18n";
import {
  allBuildPaths,
  allPagePaths,
  allPrerenderPaths,
} from "~/apps/image-adjust/shared/site-routes";
import { LANGS } from "~/platform/i18n";

describe("Image Adjust の辞書", () => {
  it("t() は変数を埋める", () => {
    expect(translate("ja", "pages.convert.title", { from: "PNG", to: "WebP" })).toBe(
      "PNG を WebP に変換",
    );
    expect(translate("en", "pages.convert.title", { from: "PNG", to: "WebP" })).toBe(
      "Convert PNG to WebP",
    );
  });
});

describe("Image Adjust のルート", () => {
  it("prerender 対象は全ページ × 全言語で、末尾スラッシュなし", () => {
    const paths = allPrerenderPaths();
    expect(paths).toHaveLength(allPagePaths().length * LANGS.length);
    expect(paths).toContain("/image-adjust");
    expect(paths).toContain("/image-adjust/en");
    expect(paths).toContain("/image-adjust/en/convert/webp-to-jpeg");
    expect(paths).toContain("/image-adjust/compress/svg");
    expect(paths.filter((p) => p !== "/" && p.endsWith("/"))).toEqual([]);
    expect(allBuildPaths()).toEqual(paths);
  });
});
