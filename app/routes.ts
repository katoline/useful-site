import { index, prefix, type RouteConfig, route } from "@react-router/dev/routes";
import { LANG_PREFIX, LANGS, type Lang } from "./i18n/langs";

/**
 * 日英の両方のルートを生成する。同じルートモジュールを言語ごとに別 id で登録する。
 * 言語は URL（useLang()）から決まる。ページを足したら app/lib/site-routes.ts も更新する。
 */
function pages(lang: Lang) {
  const id = (name: string) => `${lang}/${name}`;
  return [
    index("routes/home.tsx", { id: id("home") }),
    route("convert/:pair", "routes/convert.$pair.tsx", { id: id("convert") }),
    route("compress/:format", "routes/compress.$format.tsx", { id: id("compress") }),
    route("icons", "routes/icons.tsx", { id: id("icons") }),
    route("guide", "routes/guide._index.tsx", { id: id("guide-index") }),
    route("guide/:slug", "routes/guide.$slug.tsx", { id: id("guide") }),
    route("about", "routes/about.tsx", { id: id("about") }),
    route("privacy", "routes/privacy.tsx", { id: id("privacy") }),
    route("terms", "routes/terms.tsx", { id: id("terms") }),
    // 存在しないパス。/404/ としてプリレンダリングし、404.html として配信する
    route("*", "routes/not-found.tsx", { id: id("not-found") }),
  ];
}

export default LANGS.flatMap((lang) => {
  const p = LANG_PREFIX[lang];
  return p ? prefix(p, pages(lang)) : pages(lang);
}) satisfies RouteConfig;
