import type { Lang } from "../i18n/langs.ts";
export function createAppPaths(appPath: string) {
  function localizedPath(lang: Lang, page: string): string {
    const parts = [appPath, lang === "en" ? "en" : "", page.replace(/^\/+|\/+$/g, "")].filter(
      Boolean,
    );
    return parts.length ? `/${parts.join("/")}/` : "/";
  }
  function splitLangPath(pathname: string): { lang: Lang; page: string } {
    const segments = pathname.split("/").filter(Boolean);
    if (appPath && segments[0] === appPath) segments.shift();
    const lang = segments[0] === "en" ? "en" : "ja";
    if (lang === "en") segments.shift();
    return { lang, page: segments.join("/") };
  }
  return {
    localizedPath,
    splitLangPath,
    withBase: (page: string) => localizedPath("ja", page),
    switchLangPath: (pathname: string, lang: Lang) =>
      localizedPath(lang, splitLangPath(pathname).page),
    pageParam: (pathname: string, section: string) => {
      const [head, value, ...rest] = splitLangPath(pathname).page.split("/");
      return head === section && value && rest.length === 0 ? value : undefined;
    },
  };
}
