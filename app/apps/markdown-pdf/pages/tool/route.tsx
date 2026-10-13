/** ツールページのルート（meta と画面） */
import { createAppPaths } from "~/platform/paths/app-paths";
import { faqJsonLd, webApplicationJsonLd } from "~/platform/seo/json-ld";
import { buildPageMeta } from "~/platform/seo/meta";
import { createT } from "../../i18n";
import { manifest } from "../../manifest";
import { faqItems } from "./faq";
import { ToolPage } from "./ToolPage";

export function meta({ location }: { location: { pathname: string } }) {
  const { lang, page } = createAppPaths(manifest.path).splitLangPath(location.pathname);
  const t = createT(lang);
  const description = t("page.description");
  return buildPageMeta({
    lang,
    appPath: manifest.path,
    appName: manifest.name[lang],
    page,
    title: t("page.metaTitle"),
    description,
    // このアプリの OGP 画像はまだ無い
    image: false,
    jsonLd: [
      webApplicationJsonLd({
        lang,
        page,
        appPath: manifest.path,
        name: t("page.appName"),
        description,
        applicationCategory: "BusinessApplication",
        browserRequirements: "Requires JavaScript",
      }),
      faqJsonLd(faqItems(t)),
    ],
  });
}

export default ToolPage;
