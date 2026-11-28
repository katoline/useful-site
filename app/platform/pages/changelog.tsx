import { type ContentModule, pickContent } from "../content/mdx";
import { useLang } from "../i18n";
import { LegalPage } from "../legal/LegalPage";
import { buildPageMeta, metaContext } from "../seo/meta";
import type { Route } from "./+types/changelog";

const CONTENT = import.meta.glob<ContentModule>("../content/*/changelog.mdx", { eager: true });
export function meta({ location }: Route.MetaArgs) {
  const { lang } = metaContext(location.pathname);
  const content = pickContent(CONTENT, lang, "changelog");
  return content ? buildPageMeta({ lang, page: "changelog", ...content.frontmatter }) : [];
}
/** 更新履歴（サイト共通。ツールと記事の追加・改善の記録） */
export default function ChangelogPage() {
  const content = pickContent(CONTENT, useLang(), "changelog");
  return content ? <LegalPage page="changelog" content={content} /> : null;
}
