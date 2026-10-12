/**
 * 構造化データ（JSON-LD）の組み立て（plan.md §3.7）。
 * meta() からは { "script:ld+json": data } で <head> に出す（buildPageMeta の jsonLd）。
 * 本文中に置きたいときは JsonLd コンポーネントを使う。
 */
import { type Lang, localizedPath } from "~/i18n";
import { absoluteUrl, SITE_NAME } from "~/lib/config";

export interface BreadcrumbItem {
  name: string;
  /** 言語に依存しないページパス */
  page: string;
}

export function breadcrumbJsonLd(lang: Lang, items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(localizedPath(lang, item.page)),
    })),
  };
}

/** ツールページ */
export function webApplicationJsonLd(input: {
  lang: Lang;
  page: string;
  name: string;
  description: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: input.name,
    description: input.description,
    url: absoluteUrl(localizedPath(input.lang, input.page)),
    inLanguage: input.lang,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires JavaScript and WebAssembly",
    offers: { "@type": "Offer", price: "0", priceCurrency: "JPY" },
  };
}

/** 解説ページ */
export function articleJsonLd(input: {
  lang: Lang;
  page: string;
  headline: string;
  description: string;
  datePublished?: string;
  dateModified?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.headline,
    description: input.description,
    inLanguage: input.lang,
    mainEntityOfPage: absoluteUrl(localizedPath(input.lang, input.page)),
    publisher: { "@type": "Organization", name: SITE_NAME },
    ...(input.datePublished ? { datePublished: input.datePublished } : {}),
    ...(input.dateModified ? { dateModified: input.dateModified } : {}),
  };
}

/** FAQ */
export function faqJsonLd(items: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

/** JSON を <script> に安全に埋め込む（</script> での脱出を防ぐ） */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}
