import { SITE_NAME } from "../config";
import { langFromPathname, translate, useLang } from "../i18n";
import { defaultOgImageUrl } from "../seo/meta";
import { NotFound } from "./NotFound";
import { Shell } from "./Shell";
export function meta({ location }: { location: { pathname: string } }) {
  // 共有されたときのためにサイト共通の OGP 画像だけ付ける（検索には載せない）
  return [
    { name: "robots", content: "noindex" },
    { property: "og:image", content: defaultOgImageUrl(langFromPathname(location.pathname)) },
  ];
}
export default function NotFoundRoute() {
  const lang = useLang();
  return (
    <Shell
      config={{
        appPath: "",
        pathname: lang === "en" ? "/en/404/" : "/404/",
        name: SITE_NAME,
        menu: [],
      }}
    >
      <title>{translate(lang, "errors.notFoundTitle")}</title>
      <NotFound />
    </Shell>
  );
}
