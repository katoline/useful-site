import { LANGS } from "../i18n/langs.ts";
import { createAppPaths } from "../paths/app-paths.ts";

export const SITE_LEGAL_PAGES = ["privacy", "terms"] as const;
export type LegalPage = (typeof SITE_LEGAL_PAGES)[number];
/** サイト共通のページ（運営者情報と規約類）。ドメイン直下に置く（/about/・/privacy/・/terms/） */
export const SITE_PAGES = ["about", ...SITE_LEGAL_PAGES] as const;
export type SitePage = (typeof SITE_PAGES)[number];
export const EXTERNAL_TRANSMISSION_ANCHOR = "external-transmission";

export function isLegalPage(page: SitePage): page is LegalPage {
  return (SITE_LEGAL_PAGES as readonly string[]).includes(page);
}

/** サイト共通のページの prerender の対象（末尾スラッシュなし） */
export function allSitePageBuildPaths(): string[] {
  return LANGS.flatMap((lang) =>
    SITE_PAGES.map((page) => createAppPaths("").localizedPath(lang, page).replace(/\/$/, "")),
  );
}
