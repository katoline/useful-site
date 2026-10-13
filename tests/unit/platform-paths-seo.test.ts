import { describe, expect, it } from "vitest";
import { SITE_NAME, SITE_ORIGIN } from "~/platform/config";
import { createAppPaths, parsePath, switchLangPath } from "~/platform/paths";
import { articleJsonLd, webApplicationJsonLd } from "~/platform/seo/json-ld";
import { buildPageMeta } from "~/platform/seo/meta";

describe("複数アプリのURL境界", () => {
  it("アプリ内で言語を切り替え、未知の先頭セグメントはポータルとして扱う", () => {
    expect(parsePath("/image-adjust/en/icons/")).toEqual({
      appPath: "image-adjust",
      lang: "en",
      page: "icons",
    });
    expect(parsePath("/unknown/en/icons/")).toEqual({
      appPath: "",
      lang: "ja",
      page: "unknown/en/icons",
    });
    expect(switchLangPath("/image-adjust/convert/png-to-webp/", "en")).toBe(
      "/image-adjust/en/convert/png-to-webp/",
    );
    expect(createAppPaths("").localizedPath("ja", "")).toBe("/");
    expect(createAppPaths("").localizedPath("en", "")).toBe("/en/");
  });
  it("Image AdjustのURLとOG画像を維持し、パンくずをサイト→アプリ→ページにする", () => {
    const tags = buildPageMeta({
      lang: "en",
      appPath: "image-adjust",
      appName: "Image Adjust",
      page: "icons",
      title: "Icons",
      description: "Icons",
    });
    expect(tags).toContainEqual({
      tagName: "link",
      rel: "canonical",
      href: `${SITE_ORIGIN}/image-adjust/en/icons/`,
    });
    expect(tags).toContainEqual({
      property: "og:image",
      content: `${SITE_ORIGIN}/image-adjust/og/en.png`,
    });
    expect(tags).toContainEqual({
      tagName: "link",
      rel: "alternate",
      hrefLang: "ja",
      href: `${SITE_ORIGIN}/image-adjust/icons/`,
    });
    const crumb = tags.find((tag) => "script:ld+json" in tag) as {
      "script:ld+json": { itemListElement: { name: string; item: string }[] };
    };
    expect(
      crumb["script:ld+json"].itemListElement.map(({ name, item }) => ({ name, item })),
    ).toEqual([
      { name: SITE_NAME.en, item: `${SITE_ORIGIN}/en/` },
      { name: "Image Adjust", item: `${SITE_ORIGIN}/image-adjust/en/` },
      { name: "Icons", item: `${SITE_ORIGIN}/image-adjust/en/icons/` },
    ]);
  });
  it("記事とツールの構造化データにもアプリパスを含める", () => {
    expect(
      webApplicationJsonLd({
        lang: "ja",
        appPath: "image-adjust",
        page: "icons",
        name: "Icons",
        description: "Icons",
      }).url,
    ).toBe(`${SITE_ORIGIN}/image-adjust/icons/`);
    expect(
      articleJsonLd({
        lang: "en",
        appPath: "image-adjust",
        page: "guide/favicon-setup",
        headline: "Guide",
        description: "Guide",
      }).mainEntityOfPage,
    ).toBe(`${SITE_ORIGIN}/image-adjust/en/guide/favicon-setup/`);
  });
});
