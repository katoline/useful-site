import { ContentPage, contentPageMeta } from "~/components/content/ContentPage";
import { type ContentModule, pickContent } from "~/components/content/mdx";
import { NotFound } from "~/components/layout/NotFound";
import { metaContext } from "~/components/seo/meta";
import { useLang } from "~/i18n";
import type { Route } from "./+types/about";

/** 本文は content/<lang>/about.mdx */
const CONTENT = import.meta.glob<ContentModule>("../../content/*/about.mdx", { eager: true });

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
