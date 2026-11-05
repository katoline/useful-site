import { type ContentModule, pickContent } from "../content/mdx";
import { useLang } from "../i18n";
import { LegalPage } from "../legal/LegalPage";
import { buildPageMeta, metaContext } from "../seo/meta";
import type { Route } from "./+types/about";

const CONTENT = import.meta.glob<ContentModule>("../content/*/about.mdx", { eager: true });
export function meta({ location }: Route.MetaArgs) {
  const { lang } = metaContext(location.pathname);
  const content = pickContent(CONTENT, lang, "about");
  return content ? buildPageMeta({ lang, page: "about", ...content.frontmatter }) : [];
}
/** 運営者情報・お問い合わせ（サイト共通） */
export default function AboutPage() {
  const content = pickContent(CONTENT, useLang(), "about");
  return content ? <LegalPage page="about" content={content} /> : null;
}
