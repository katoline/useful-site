import { index, layout, prefix, type RouteConfig, route } from "@react-router/dev/routes";
import { LANG_PREFIX, LANGS, type Lang } from "../../platform/i18n/langs.ts";
import { createAppPaths } from "../../platform/paths/app-paths.ts";
import { GUIDE_SLUGS } from "./domain/guides.ts";
import { manifest } from "./manifest.ts";

export const appPath = manifest.path;

function pages(lang: Lang): Awaited<RouteConfig> {
  const id = (name: string) => `${manifest.id}/${lang}/${name}`;
  return [
    layout("apps/sound-meter/layout.tsx", { id: id("layout") }, [
      index("apps/sound-meter/pages/tool/route.tsx", { id: id("tool") }),
      route("guide", "apps/sound-meter/pages/guide-index/route.tsx", { id: id("guide") }),
      ...GUIDE_SLUGS.map((slug) =>
        route(`guide/${slug}`, "apps/sound-meter/pages/guide-article/route.tsx", {
          id: id(`guide/${slug}`),
        }),
      ),
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
  return ["", "guide", ...GUIDE_SLUGS.map((slug) => `guide/${slug}`)];
}

/** prerender の対象。末尾スラッシュなしで渡す（付けると本文の無い SPA フォールバックになる） */
export function allBuildPaths(): string[] {
  const { localizedPath } = createAppPaths(manifest.path);
  return LANGS.flatMap((lang) =>
    allPagePaths().map((page) => localizedPath(lang, page).replace(/\/+$/, "")),
  );
}
