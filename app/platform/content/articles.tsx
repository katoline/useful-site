/**
 * アプリの解説記事（content/<lang>/<slug>.mdx）の一覧・本文・meta の共通部分。
 * 各アプリの pages/guide-index・pages/guide-article から使う（記事の一覧はアプリが domain に持つ）。
 */
import type { MetaDescriptor } from "react-router";
import { AdSlot } from "../ads/AdSlot";
import { createT, type Lang, LOCALE, useI18n } from "../i18n";
import { articleJsonLd } from "../seo/json-ld";
import { buildPageMeta } from "../seo/meta";
import { LocalizedLink } from "../shell/LocalizedLink";
import { PageHeader } from "../shell/PageHeader";
import { ContentBody, type ContentFrontmatter, type ContentModule, pickContent } from "./mdx";

/** 記事の一覧・本文のページパス（アプリのパスからの相対） */
export const GUIDE_PAGE = "guide";
export function guidePage(slug: string): string {
  return `${GUIDE_PAGE}/${slug}`;
}

/** ページパス（"guide/<slug>"）から slug を取り出す。一覧に無ければ undefined */
export function guideSlugOf<S extends string>(page: string, slugs: readonly S[]): S | undefined {
  const slug = page.replace(/\/+$/, "").split("/")[1];
  return slugs.find((item) => item === slug);
}

export function formatContentDate(lang: Lang, ymd: string): string {
  const date = new Date(`${ymd}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return ymd;
  return new Intl.DateTimeFormat(LOCALE[lang], {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export interface GuideItem {
  slug: string;
  title: string;
  description: string;
}

/** 記事の frontmatter（import.meta.glob の import: "frontmatter"）から、slug の順に一覧を作る */
export function guideItems(
  frontmatters: Record<string, ContentFrontmatter>,
  lang: Lang,
  slugs: readonly string[],
): GuideItem[] {
  return slugs.flatMap((slug) => {
    const key = Object.keys(frontmatters).find((k) => k.endsWith(`/content/${lang}/${slug}.mdx`));
    const frontmatter = key ? frontmatters[key] : undefined;
    return frontmatter
      ? [{ slug, title: frontmatter.title, description: frontmatter.description }]
      : [];
  });
}

/** 記事のカードの一覧 */
export function GuideList({ items }: { items: GuideItem[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {items.map(({ slug, title, description }) => (
        <li key={slug}>
          <LocalizedLink
            page={guidePage(slug)}
            className="flex h-full flex-col gap-2 rounded-lg border border-border bg-card p-5 transition-colors hover:bg-accent"
          >
            <span className="font-semibold text-card-foreground">{title}</span>
            <span className="text-sm text-muted-foreground">{description}</span>
          </LocalizedLink>
        </li>
      ))}
    </ul>
  );
}

/** ツールのページの下に置く「使い方と解説」 */
export function RelatedGuides({ items }: { items: GuideItem[] }) {
  const { t } = useI18n();
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="related-guides" className="mt-12 print:hidden">
      <h2 id="related-guides" className="mb-4 text-xl font-semibold">
        {t("content.related")}
      </h2>
      <GuideList items={items} />
    </section>
  );
}

/** 記事の一覧ページ */
export function GuideIndexPage({ appName, items }: { appName: string; items: GuideItem[] }) {
  const { t } = useI18n();
  return (
    <>
      <PageHeader
        title={t("content.guideTitle", { app: appName })}
        lead={t("content.guideDescription", { app: appName })}
      />
      <GuideList items={items} />
    </>
  );
}

export function guideIndexMeta(input: {
  lang: Lang;
  appPath: string;
  appName: string;
}): MetaDescriptor[] {
  const { lang, appPath, appName } = input;
  const t = createT(lang);
  return buildPageMeta({
    lang,
    appPath,
    appName,
    page: GUIDE_PAGE,
    title: t("content.guideTitle", { app: appName }),
    description: t("content.guideDescription", { app: appName }),
  });
}

/** 記事の meta（Article の JSON-LD と、ガイドの一覧を挟んだパンくず） */
export function guideArticleMeta(input: {
  lang: Lang;
  appPath: string;
  appName: string;
  page: string;
  content: ContentModule;
}): MetaDescriptor[] {
  const { lang, appPath, appName, page, content } = input;
  const guideTitle = createT(lang)("content.guideTitle", { app: appName });
  const { title, description, datePublished, dateModified } = content.frontmatter;
  return buildPageMeta({
    lang,
    appPath,
    appName,
    page,
    title,
    description,
    ogType: "article",
    breadcrumbs: [
      { name: guideTitle, page: GUIDE_PAGE },
      { name: title, page },
    ],
    jsonLd: [
      articleJsonLd({
        lang,
        page,
        appPath,
        headline: title,
        description,
        datePublished,
        dateModified,
      }),
    ],
  });
}

/** 記事の本文。本文中の <Ad /> と、本文の後の 1 枠で記事内広告は 2 枠まで */
export function GuideArticle({ content, appPath }: { content: ContentModule; appPath: string }) {
  const { t, lang } = useI18n();
  const { title, dateModified } = content.frontmatter;
  return (
    <article>
      <PageHeader
        title={title}
        lead={
          <time dateTime={dateModified} className="text-sm">
            {t("content.updated", { date: formatContentDate(lang, dateModified) })}
          </time>
        }
      />
      <ContentBody content={content} appPath={appPath} />
      <AdSlot format="in-article" className="mt-12 max-w-3xl" />
    </article>
  );
}

export { pickContent };
