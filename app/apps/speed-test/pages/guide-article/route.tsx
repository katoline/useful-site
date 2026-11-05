import { useLocation } from "react-router";
import {
  GuideArticle,
  guideArticleMeta,
  guideSlugOf,
  pickContent,
} from "~/platform/content/articles";
import type { ContentModule } from "~/platform/content/mdx";
import type { Lang } from "~/platform/i18n";
import { createAppPaths } from "~/platform/paths/app-paths";
import { NotFound } from "~/platform/shell/NotFound";
import { GUIDE_SLUGS } from "../../domain/guides";
import { manifest } from "../../manifest";

/** 記事の本文。プリレンダリングとハイドレーションで同じ本文を出すため eager で読む（このルートのチャンクにだけ入る） */
const GUIDES = import.meta.glob<ContentModule>("../../content/*/*.mdx", { eager: true });

/** routes.ts が GUIDE_SLUGS の値ごとに登録する静的ルート。slug はパスから取り出す */
function contentFor(pathname: string): { lang: Lang; page: string; content?: ContentModule } {
  const { lang, page } = createAppPaths(manifest.path).splitLangPath(pathname);
  const slug = guideSlugOf(page, GUIDE_SLUGS);
  return { lang, page, content: slug ? pickContent(GUIDES, lang, slug) : undefined };
}

export function meta({ location }: { location: { pathname: string } }) {
  const { lang, page, content } = contentFor(location.pathname);
  if (!content) return [{ name: "robots", content: "noindex" }];
  return guideArticleMeta({
    lang,
    appPath: manifest.path,
    appName: manifest.name[lang],
    page,
    content,
  });
}

/** 解説記事 */
export default function GuideArticlePage() {
  const { content } = contentFor(useLocation().pathname);
  if (!content) return <NotFound />;
  return <GuideArticle content={content} appPath={manifest.path} />;
}
