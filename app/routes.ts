import { index, prefix, type RouteConfig, route } from "@react-router/dev/routes";
import { LANG_PREFIX, LANGS, type Lang } from "./i18n/langs";
import { COMPRESS_FORMATS, CONVERT_PAIRS, GUIDE_SLUGS } from "./lib/site-routes";

/**
 * 日英の両方のルートを生成する。同じルートモジュールを言語ごとに別 id で登録する。
 * 言語は URL（useLang()）から決まる。ページを足したら app/lib/site-routes.ts も更新する。
 *
 * 変換・圧縮・解説は動的セグメント（:pair 等）を使わず、site-routes.ts の値ごとに静的ルートを登録する。
 * 動的ルートだと不正な値（/convert/bogus/）でも配信は 404.html なのに、クライアントは convert に
 * マッチしてハイドレーションが食い違う。静的ルートなら不正な値は splat（not-found）に落ちる。
 * 値はページ側でパスから取り出す（app/lib/site-routes.ts の pageParam()）。
 */
function pages(lang: Lang) {
  const id = (name: string) => `${lang}/${name}`;
  return [
    index("routes/home.tsx", { id: id("home") }),
    ...CONVERT_PAIRS.map((pair) =>
      route(`convert/${pair}`, "routes/convert.tsx", { id: id(`convert/${pair}`) }),
    ),
    ...COMPRESS_FORMATS.map((format) =>
      route(`compress/${format}`, "routes/compress.tsx", { id: id(`compress/${format}`) }),
    ),
    route("icons", "routes/icons.tsx", { id: id("icons") }),
    route("guide", "routes/guide._index.tsx", { id: id("guide-index") }),
    ...GUIDE_SLUGS.map((slug) =>
      route(`guide/${slug}`, "routes/guide.article.tsx", { id: id(`guide/${slug}`) }),
    ),
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
