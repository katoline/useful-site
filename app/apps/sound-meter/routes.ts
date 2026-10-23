import { index, layout, prefix, type RouteConfig } from "@react-router/dev/routes";
import { LANG_PREFIX, LANGS, type Lang } from "../../platform/i18n/langs.ts";
import { createAppPaths } from "../../platform/paths/app-paths.ts";
import { manifest } from "./manifest.ts";

export const appPath = manifest.path;

function pages(lang: Lang): Awaited<RouteConfig> {
  const id = (name: string) => `${manifest.id}/${lang}/${name}`;
  return [
    layout("apps/sound-meter/layout.tsx", { id: id("layout") }, [
      index("apps/sound-meter/pages/tool/route.tsx", { id: id("tool") }),
    ]),
  ];
}

export function createRoutes(): Awaited<RouteConfig> {
  return LANGS.flatMap((lang) =>
    LANG_PREFIX[lang] ? prefix(LANG_PREFIX[lang], pages(lang)) : pages(lang),
  );
}

/** sitemap に載せるページ（言語に依存しないパス） */
export function allPagePaths(): string[] {
  return [""];
}

/** prerender の対象。末尾スラッシュなしで渡す（付けると本文の無い SPA フォールバックになる） */
export function allBuildPaths(): string[] {
  const { localizedPath } = createAppPaths(manifest.path);
  return LANGS.flatMap((lang) =>
    allPagePaths().map((page) => localizedPath(lang, page).replace(/\/+$/, "")),
  );
}
