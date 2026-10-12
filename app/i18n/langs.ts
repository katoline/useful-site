/** 対応言語と URL の対応（React に依存しない。react-router.config.ts からも使う） */
export const LANGS = ["ja", "en"] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = "ja";

/** 言語ごとの URL 接頭辞（BASE_PATH からの相対）。既定言語は接頭辞なし */
export const LANG_PREFIX: Record<Lang, string> = { ja: "", en: "en" };

export function isLang(value: unknown): value is Lang {
  return typeof value === "string" && (LANGS as readonly string[]).includes(value);
}

/**
 * ルーターの pathname（basename を除いたもの。例 "/en/about/"）から言語と、
 * 言語に依存しないページパス（例 "about"）を取り出す。
 */
export function splitLangPath(pathname: string): { lang: Lang; page: string } {
  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0];
  for (const lang of LANGS) {
    const prefix = LANG_PREFIX[lang];
    if (prefix && first === prefix) {
      return { lang, page: segments.slice(1).join("/") };
    }
  }
  return { lang: DEFAULT_LANG, page: segments.join("/") };
}

export function langFromPathname(pathname: string): Lang {
  return splitLangPath(pathname).lang;
}

/**
 * 言語とページパスから、ルーター用のパス（basename を除く、末尾スラッシュ付き）を作る。
 * 例 ("en", "about") → "/en/about/"、("ja", "") → "/"
 */
export function localizedPath(lang: Lang, page: string): string {
  const parts = [LANG_PREFIX[lang], page.replace(/^\/+|\/+$/g, "")].filter(Boolean);
  return parts.length ? `/${parts.join("/")}/` : "/";
}

/** 表示中のページの他言語版のパス（basename を除く） */
export function switchLangPath(pathname: string, to: Lang): string {
  return localizedPath(to, splitLangPath(pathname).page);
}
