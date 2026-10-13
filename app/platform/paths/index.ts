import { createAppPaths } from "./app-paths";

export { createAppPaths } from "./app-paths";

import type { Lang } from "../i18n/langs";
import { allApps } from "../registry";

export { RESERVED_APP_PATHS } from "../registry/validation";

const appPaths = allApps.map((app) => app.path).filter(Boolean);

export function parsePath(pathname: string) {
  const first = pathname.split("/").filter(Boolean)[0];
  const appPath = first && appPaths.includes(first) ? first : "";
  return { appPath, ...createAppPaths(appPath).splitLangPath(pathname) };
}
export function switchLangPath(pathname: string, lang: Lang) {
  const { appPath, page } = parsePath(pathname);
  return createAppPaths(appPath).localizedPath(lang, page);
}
