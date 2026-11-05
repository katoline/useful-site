/** ツールページのルート（meta と画面） */
import { guideItems, RelatedGuides } from "~/platform/content/articles";
import type { ContentFrontmatter } from "~/platform/content/mdx";
import { useLang } from "~/platform/i18n";
import { createAppPaths } from "~/platform/paths/app-paths";
import { faqJsonLd, webApplicationJsonLd } from "~/platform/seo/json-ld";
import { buildPageMeta } from "~/platform/seo/meta";
import { GUIDE_SLUGS } from "../../domain/guides";
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
    jsonLd: [
      webApplicationJsonLd({
        lang,
        page,
        appPath: manifest.path,
        name: t("page.appName"),
        description,
        applicationCategory: "UtilitiesApplication",
        browserRequirements: "Requires JavaScript and a microphone",
      }),
      faqJsonLd(faqItems(t)),
    ],
  });
}

const GUIDES = import.meta.glob<ContentFrontmatter>("../../content/*/*.mdx", {
  eager: true,
  import: "frontmatter",
});

/** ツールと、その下の「使い方と解説」（記事へのリンク） */
export default function ToolRoute() {
  const lang = useLang();
  return (
    <>
      <ToolPage />
      <RelatedGuides items={guideItems(GUIDES, lang, GUIDE_SLUGS)} />
    </>
  );
}
