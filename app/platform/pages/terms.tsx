import { type ContentModule, pickContent } from "../content/mdx";
import { useLang } from "../i18n";
import { LegalPage } from "../legal/LegalPage";
import { buildPageMeta, metaContext } from "../seo/meta";
import type { Route } from "./+types/terms";

const CONTENT = import.meta.glob<ContentModule>("../content/*/terms.mdx", { eager: true });
export function meta({ location }: Route.MetaArgs) {
  const { lang } = metaContext(location.pathname);
  const content = pickContent(CONTENT, lang, "terms");
  return content
    ? buildPageMeta({ lang, page: "terms", ...content.frontmatter, image: false })
    : [];
}
export default function TermsPage() {
  const content = pickContent(CONTENT, useLang(), "terms");
  return content ? <LegalPage page="terms" content={content} /> : null;
}
