import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SITE_ORIGIN } from "~/platform/config";
import { buildPageMeta } from "~/platform/seo/meta";
import {
  appOgImageFile,
  findAppOgImagePaths,
  loadApps,
  OG_LANGS,
  siteOgImageFile,
} from "../../scripts/lib/app-og-images.ts";

const ROOT = path.resolve(import.meta.dirname, "../..");

/** PNG の幅と高さ（IHDR） */
async function pngSize(file: string): Promise<{ width: number; height: number }> {
  const data = await readFile(file);
  expect(data.subarray(1, 4).toString("latin1")).toBe("PNG");
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

function ogImageOf(tags: ReturnType<typeof buildPageMeta>): string | undefined {
  const tag = tags.find((t) => "property" in t && t.property === "og:image") as
    | { content: string }
    | undefined;
  return tag?.content;
}

describe("OGP 画像のファイル", () => {
  it("サイト共通と、ポータル以外の全アプリに日英の 1200×630 の PNG がある", async () => {
    const files = OG_LANGS.map((lang) => siteOgImageFile(ROOT, lang));
    for (const { dir, manifest } of await loadApps(ROOT)) {
      if (manifest.path) files.push(...OG_LANGS.map((lang) => appOgImageFile(dir, lang)));
    }
    for (const file of files) {
      expect(await pngSize(file), path.relative(ROOT, file)).toEqual({ width: 1200, height: 630 });
    }
  });
});

describe("buildPageMeta の既定の og:image", () => {
  it("アプリの画像があればそれを、無ければサイト共通の画像を指す", async () => {
    const withImage = await findAppOgImagePaths(ROOT);
    expect(withImage.length).toBeGreaterThan(0);
    for (const appPath of withImage) {
      for (const lang of OG_LANGS) {
        expect(
          ogImageOf(buildPageMeta({ lang, appPath, page: "", title: "t", description: "d" })),
        ).toBe(`${SITE_ORIGIN}/${appPath}/og/${lang}.png`);
      }
    }
    // 画像を持たないアプリ・ポータル・規約類はサイト共通
    expect(
      ogImageOf(
        buildPageMeta({
          lang: "en",
          appPath: "no-such-app",
          page: "",
          title: "t",
          description: "d",
        }),
      ),
    ).toBe(`${SITE_ORIGIN}/og/en.png`);
    expect(
      ogImageOf(buildPageMeta({ lang: "ja", page: "privacy", title: "t", description: "d" })),
    ).toBe(`${SITE_ORIGIN}/og/ja.png`);
    // false なら付けない
    expect(
      ogImageOf(
        buildPageMeta({ lang: "ja", page: "", title: "t", description: "d", image: false }),
      ),
    ).toBeUndefined();
  });
});
