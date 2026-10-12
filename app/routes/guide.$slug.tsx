import { ContentPage, contentPageMeta } from "~/components/content/ContentPage";
import { type ContentModule, pickContent } from "~/components/content/mdx";
import { NotFound } from "~/components/layout/NotFound";
import { metaContext } from "~/components/seo/meta";
import { useLang } from "~/i18n";
import { isGuideSlug } from "~/lib/site-routes";
import type { Route } from "./+types/guide.$slug";

/**
 * 解説記事（content/<lang>/<slug>.mdx）。プリレンダリングとハイドレーションで同じ本文を出すため eager で読む
 * （このルートのチャンクにだけ入る。規約類は除く）
 */
const GUIDES = import.meta.glob<ContentModule>(
  ["../../content/*/*.mdx", "!../../content/*/{about,privacy,terms}.mdx"],
  { eager: true },
);

export function meta({ location, params }: Route.MetaArgs) {
  const { lang, page, t } = metaContext(location.pathname);
  const content = isGuideSlug(params.slug) ? pickContent(GUIDES, lang, params.slug) : undefined;
  if (!content) {
    return [{ title: t("errors.notFoundTitle") }, { name: "robots", content: "noindex" }];
  }
  return contentPageMeta({
    lang,
    page,
    content,
    article: true,
    breadcrumbs: [
      { name: t("pages.guide.title"), page: "guide" },
      { name: content.frontmatter.title, page },
    ],
  });
}

/** 解説ページ */
export default function GuideArticle({ params }: Route.ComponentProps) {
  const lang = useLang();
  const content = isGuideSlug(params.slug) ? pickContent(GUIDES, lang, params.slug) : undefined;
  if (!content) return <NotFound />;
  return <ContentPage content={content} ads />;
}
