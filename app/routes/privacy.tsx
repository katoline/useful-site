import { ContentPage, contentPageMeta } from "~/components/content/ContentPage";
import { type ContentModule, pickContent } from "~/components/content/mdx";
import { NotFound } from "~/components/layout/NotFound";
import { metaContext } from "~/components/seo/meta";
import { useLang } from "~/i18n";
import type { Route } from "./+types/privacy";

/** 本文は content/<lang>/privacy.mdx */
const CONTENT = import.meta.glob<ContentModule>("../../content/*/privacy.mdx", { eager: true });

export function meta({ location }: Route.MetaArgs) {
  const { lang, page, t } = metaContext(location.pathname);
  const content = pickContent(CONTENT, lang, "privacy");
  if (!content) return [{ title: t("errors.notFoundTitle") }];
  return contentPageMeta({ lang, page, content });
}

export default function Privacy() {
  const content = pickContent(CONTENT, useLang(), "privacy");
  if (!content) return <NotFound />;
  return <ContentPage content={content} />;
}
