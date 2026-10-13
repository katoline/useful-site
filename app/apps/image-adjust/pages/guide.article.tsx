import { useLocation } from "react-router";
import { ContentPage, contentPageMeta } from "~/apps/image-adjust/components/content/ContentPage";
import { type ContentModule, pickContent } from "~/apps/image-adjust/components/content/mdx";
import { type Lang, useLang } from "~/apps/image-adjust/i18n";
import { isGuideSlug, pageParam } from "~/apps/image-adjust/lib/site-routes";
import { metaContext } from "~/apps/image-adjust/seo/meta";
import { NotFound } from "~/platform/shell/NotFound";
import type { Route } from "./+types/guide.article";

/**
 * 解説記事（content/<lang>/<slug>.mdx）。プリレンダリングとハイドレーションで同じ本文を出すため eager で読む
 * （このルートのチャンクにだけ入る。規約類は除く）
 */
const GUIDES = import.meta.glob<ContentModule>(
  ["../content/*/*.mdx", "!../content/*/{about,privacy,terms}.mdx"],
  { eager: true },
);

/** 記事（app/routes.ts が GUIDE_SLUGS の値ごとに登録する静的ルート）。slug はパスから取り出す */
function contentFor(lang: Lang, pathname: string) {
  const slug = pageParam(pathname, "guide");
  return isGuideSlug(slug) ? pickContent(GUIDES, lang, slug) : undefined;
}

export function meta({ location }: Route.MetaArgs) {
  const { lang, page, t } = metaContext(location.pathname);
  const content = contentFor(lang, location.pathname);
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
export default function GuideArticle() {
  const lang = useLang();
  const content = contentFor(lang, useLocation().pathname);
  if (!content) return <NotFound />;
  return <ContentPage content={content} ads />;
}
