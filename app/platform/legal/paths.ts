import { LANGS } from "../i18n/langs.ts";
import { createAppPaths } from "../paths/app-paths.ts";

export const SITE_LEGAL_PAGES = ["privacy", "terms"] as const;
export type LegalPage = (typeof SITE_LEGAL_PAGES)[number];
export const EXTERNAL_TRANSMISSION_ANCHOR = "external-transmission";

export function allLegalBuildPaths(): string[] {
  return LANGS.flatMap((lang) =>
    SITE_LEGAL_PAGES.map((page) => createAppPaths("").localizedPath(lang, page).replace(/\/$/, "")),
  );
}
