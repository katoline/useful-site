/**
 * MDX の記事ページ（ガイド・運営者情報・プライバシーポリシー・利用規約）の共通部分。
 */
import { AdSlot } from "~/components/ads/AdSlot";
import { PageHeader } from "~/components/layout/PageHeader";
import { articleJsonLd, type BreadcrumbItem } from "~/components/seo/json-ld";
import { buildPageMeta } from "~/components/seo/meta";
import { type Lang, LOCALE, useI18n } from "~/i18n";
import { ContentBody, type ContentModule } from "./mdx";

/** 記事ページの meta（title・description は記事の frontmatter から。article なら Article の JSON-LD も出す） */
export function contentPageMeta(input: {
  lang: Lang;
  page: string;
  content: ContentModule;
  breadcrumbs?: BreadcrumbItem[];
  article?: boolean;
}) {
  const { lang, page, content, breadcrumbs, article } = input;
  const { title, description, datePublished, dateModified } = content.frontmatter;
  return buildPageMeta({
    lang,
    page,
    title,
    description,
    ogType: article ? "article" : "website",
    breadcrumbs,
    jsonLd: article
      ? [articleJsonLd({ lang, page, headline: title, description, datePublished, dateModified })]
      : [],
  });
}

function formatDate(lang: Lang, ymd: string): string {
  const date = new Date(`${ymd}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return ymd;
  return new Intl.DateTimeFormat(LOCALE[lang], {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** 記事本文。ads を付けると本文の後にも記事内広告を 1 枠置く（本文中の <Ad /> と合わせて 2 枠まで） */
export function ContentPage({ content, ads = false }: { content: ContentModule; ads?: boolean }) {
  const { t, lang } = useI18n();
  const { title, dateModified } = content.frontmatter;
  return (
    <article>
      <PageHeader
        title={title}
        lead={
          <time dateTime={dateModified} className="text-sm">
            {t("content.updated", { date: formatDate(lang, dateModified) })}
          </time>
        }
      />
      <ContentBody content={content} />
      {ads && <AdSlot format="in-article" className="mt-12 max-w-3xl" />}
    </article>
  );
}
