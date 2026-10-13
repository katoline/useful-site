import { createAppPaths } from "../../../platform/paths/app-paths.ts";

export {
  DEFAULT_LANG,
  isLang,
  LANG_PREFIX,
  LANGS,
  type Lang,
} from "../../../platform/i18n/langs.ts";
export const { localizedPath, splitLangPath, switchLangPath } = createAppPaths("image-adjust");
export function langFromPathname(pathname: string) {
  return splitLangPath(pathname).lang;
}
