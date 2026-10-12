import { ContentPage, contentPageMeta } from "~/components/content/ContentPage";
import { type ContentModule, pickContent } from "~/components/content/mdx";
import { NotFound } from "~/components/layout/NotFound";
import { metaContext } from "~/components/seo/meta";
import { useLang } from "~/i18n";
import type { Route } from "./+types/terms";

/** 本文は content/<lang>/terms.mdx */
const CONTENT = import.meta.glob<ContentModule>("../../content/*/terms.mdx", { eager: true });

export function meta({ location }: Route.MetaArgs) {
  const { lang, page, t } = metaContext(location.pathname);
  const content = pickContent(CONTENT, lang, "terms");
  if (!content) return [{ title: t("errors.notFoundTitle") }];
  return contentPageMeta({ lang, page, content });
}

export default function Terms() {
  const content = pickContent(CONTENT, useLang(), "terms");
  if (!content) return <NotFound />;
  return <ContentPage content={content} />;
}
