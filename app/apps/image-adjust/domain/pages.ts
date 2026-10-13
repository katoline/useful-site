/**
 * ページの値の一覧（変換方向・圧縮形式・解説記事）。routes.ts が値ごとに静的ルートを作り、
 * shared/site-routes.ts が prerender・sitemap のパスを組み立てる。
 * ルートを足すときは routes.ts・shared/site-routes.ts とここを更新する。
 */
import type { ImageFormat } from "./format.ts";

/** 変換方向ごとの入口ページ（/convert/:pair） */
export const CONVERT_PAIRS = [
  "png-to-jpeg",
  "png-to-webp",
  "jpeg-to-png",
  "jpeg-to-webp",
  "webp-to-png",
  "webp-to-jpeg",
] as const;
export type ConvertPair = (typeof CONVERT_PAIRS)[number];

/** 形式の表示名 */
export const FORMAT_LABEL = {
  png: "PNG",
  jpeg: "JPEG",
  webp: "WebP",
  gif: "GIF",
  svg: "SVG",
} as const satisfies Record<ImageFormat, string>;

/** "png-to-webp" → { from: "png", to: "webp" } */
export function parseConvertPair(pair: ConvertPair): { from: ImageFormat; to: ImageFormat } {
  const [from, to] = pair.split("-to-") as [ImageFormat, ImageFormat];
  return { from, to };
}

/** 圧縮の入口ページ（/compress/:format） */
export const COMPRESS_FORMATS = ["jpeg", "png", "webp", "gif", "svg"] as const;
export type CompressFormat = (typeof COMPRESS_FORMATS)[number];

/** 解説ページ（/guide/:slug）。記事を足したらここにも足す */
export const GUIDE_SLUGS = ["image-formats", "favicon-setup", "optimize-lp-images"] as const;
export type GuideSlug = (typeof GUIDE_SLUGS)[number];

export function isConvertPair(v: string | undefined): v is ConvertPair {
  return !!v && (CONVERT_PAIRS as readonly string[]).includes(v);
}
export function isCompressFormat(v: string | undefined): v is CompressFormat {
  return !!v && (COMPRESS_FORMATS as readonly string[]).includes(v);
}
export function isGuideSlug(v: string | undefined): v is GuideSlug {
  return !!v && (GUIDE_SLUGS as readonly string[]).includes(v);
}
