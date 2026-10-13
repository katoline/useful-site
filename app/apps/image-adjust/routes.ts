import { index, layout, prefix, type RouteConfig, route } from "@react-router/dev/routes";
import { LANG_PREFIX, LANGS, type Lang } from "../../platform/i18n/langs.ts";
import { COMPRESS_FORMATS, CONVERT_PAIRS, GUIDE_SLUGS } from "./domain/pages.ts";
import { manifest } from "./manifest.ts";

export { allBuildPaths, allPagePaths } from "./shared/site-routes.ts";
export const appPath = manifest.path;

function pages(lang: Lang): Awaited<RouteConfig> {
  const id = (name: string) => `${manifest.id}/${lang}/${name}`;
  const page = (name: string) => `apps/image-adjust/pages/${name}/route.tsx`;
  return [
    layout(`apps/image-adjust/layout.${lang}.tsx`, { id: id("layout") }, [
      index(page("home"), { id: id("home") }),
      ...CONVERT_PAIRS.map((pair) =>
        route(`convert/${pair}`, page("convert"), { id: id(`convert/${pair}`) }),
      ),
      ...COMPRESS_FORMATS.map((format) =>
        route(`compress/${format}`, page("compress"), { id: id(`compress/${format}`) }),
      ),
      route("icons", page("icons"), { id: id("icons") }),
      route("guide", page("guide-index"), { id: id("guide-index") }),
      ...GUIDE_SLUGS.map((slug) =>
        route(`guide/${slug}`, page("guide-article"), { id: id(`guide/${slug}`) }),
      ),
      route("about", page("about"), { id: id("about") }),
    ]),
  ];
}
export function createRoutes(): Awaited<RouteConfig> {
  return LANGS.flatMap((lang) =>
    LANG_PREFIX[lang] ? prefix(LANG_PREFIX[lang], pages(lang)) : pages(lang),
  );
}
