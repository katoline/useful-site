import { ContentPage, contentPageMeta } from "~/apps/image-adjust/components/content/ContentPage";
import { type ContentModule, pickContent } from "~/apps/image-adjust/components/content/mdx";
import { useLang } from "~/apps/image-adjust/i18n";
import { metaContext } from "~/apps/image-adjust/seo/meta";
import { NotFound } from "~/platform/shell/NotFound";
import type { Route } from "./+types/about";

/** 本文は content/<lang>/about.mdx */
const CONTENT = import.meta.glob<ContentModule>("../content/*/about.mdx", { eager: true });

export function meta({ location }: Route.MetaArgs) {
  const { lang, page, t } = metaContext(location.pathname);
  const content = pickContent(CONTENT, lang, "about");
  if (!content) return [{ title: t("errors.notFoundTitle") }];
  return contentPageMeta({ lang, page, content });
}

export default function About() {
  const content = pickContent(CONTENT, useLang(), "about");
  if (!content) return <NotFound />;
  return <ContentPage content={content} />;
}
