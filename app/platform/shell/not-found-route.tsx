import { SITE_NAME } from "../config";
import { translate, useLang } from "../i18n";
import { NotFound } from "./NotFound";
import { Shell } from "./Shell";
export function meta() {
  return [{ name: "robots", content: "noindex" }];
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
