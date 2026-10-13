import { NotFound } from "~/platform/shell/NotFound";
import {
  type ContentModule,
  ContentPage,
  contentPageMeta,
  pickContent,
} from "../../features/guide-content";
import { useLang } from "../../i18n";
import { metaContext } from "../../shared/seo/meta";
import type { Route } from "./+types/route";

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
