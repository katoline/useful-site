/**
 * ページのパスの一覧（prerender・sitemap・言語切り替えの元）。
 * 変換・圧縮・解説の値（pair / format / slug）は domain/pages.ts で列挙し、routes.ts が値ごとに静的ルートを作る。
 * ルートを足すときは routes.ts とここの両方を更新する。
 */
import { COMPRESS_FORMATS, CONVERT_PAIRS, GUIDE_SLUGS } from "../domain/pages.ts";
import { LANGS, type Lang, localizedPath, splitLangPath } from "../i18n/langs.ts";

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
  return allPrerenderPaths();
}
