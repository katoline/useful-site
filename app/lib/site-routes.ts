/**
 * ページの一覧（prerender・sitemap・言語切り替えの元）。
 * 変換・圧縮・解説の値（pair / format / slug）はここで列挙し、app/routes.ts が値ごとに静的ルートを作る。
 * ルートを足すときは app/routes.ts とここの両方を更新する。
 */
import { LANGS, type Lang, localizedPath, splitLangPath } from "../i18n/langs";

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
} as const;
export type ImageFormat = keyof typeof FORMAT_LABEL;

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

/**
 * ルーターの pathname から「<section>/<値>」の値を取り出す（例 ("/en/convert/png-to-webp/", "convert")
 * → "png-to-webp"）。形が違えば undefined。値の検証は isConvertPair() 等で行う
 */
export function pageParam(pathname: string, section: string): string | undefined {
  const [head, value, ...rest] = splitLangPath(pathname).page.split("/");
  return head === section && value && rest.length === 0 ? value : undefined;
}

/** 言語に依存しないページパス（BASE_PATH・言語接頭辞を除く）の一覧 */
export function allPagePaths(): string[] {
  return [
    "",
    ...CONVERT_PAIRS.map((p) => `convert/${p}`),
    ...COMPRESS_FORMATS.map((f) => `compress/${f}`),
    "icons",
    "guide",
    ...GUIDE_SLUGS.map((s) => `guide/${s}`),
    "about",
    "privacy",
    "terms",
  ];
}

/** React Router の prerender は末尾スラッシュなしで渡す（付けると SPA フォールバックになる） */
function toPrerenderPath(routerPath: string): string {
  return routerPath === "/" ? "/" : routerPath.replace(/\/+$/, "");
}

/** prerender 対象（basename を除いたルーターのパス、日英すべて） */
export function allPrerenderPaths(langs: readonly Lang[] = LANGS): string[] {
  return langs.flatMap((lang) =>
    allPagePaths().map((page) => toPrerenderPath(localizedPath(lang, page))),
  );
}

/**
 * 404 ページ（splat ルート）をプリレンダリングするためのパス。
 * scripts/postbuild.ts が <言語>/404/index.html を <言語>/404.html に移す。
 */
export const NOT_FOUND_PAGE = "404";

/** prerender に渡す全パス（ページ＋各言語の 404） */
export function allBuildPaths(): string[] {
  return [
    ...allPrerenderPaths(),
    ...LANGS.map((lang) => toPrerenderPath(localizedPath(lang, NOT_FOUND_PAGE))),
  ];
}

/**
 * プライバシーポリシー内の「外部送信規律に基づく公表事項」の見出しの id（content/<lang>/privacy.mdx と揃える）。
 * 全ページのフッターからリンクする（plan.md §7.3）
 */
export const EXTERNAL_TRANSMISSION_ANCHOR = "external-transmission";
