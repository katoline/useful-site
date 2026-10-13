import { type ContentModule, pickContent } from "../content/mdx";
import { useLang } from "../i18n";
import { LegalPage } from "../legal/LegalPage";
import { buildPageMeta, metaContext } from "../seo/meta";
import type { Route } from "./+types/privacy";

const CONTENT = import.meta.glob<ContentModule>("../content/*/privacy.mdx", { eager: true });
export function meta({ location }: Route.MetaArgs) {
  const { lang } = metaContext(location.pathname);
  const content = pickContent(CONTENT, lang, "privacy");
  return content
    ? buildPageMeta({ lang, page: "privacy", ...content.frontmatter, image: false })
    : [];
}
export default function PrivacyPage() {
  const content = pickContent(CONTENT, useLang(), "privacy");
  return content ? <LegalPage page="privacy" content={content} /> : null;
}
