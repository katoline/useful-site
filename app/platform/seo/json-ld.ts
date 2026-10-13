import { absoluteUrl, SITE_NAME } from "~/platform/config";
/**
 * 構造化データ（JSON-LD）の組み立て（plan.md §3.7）。
 * meta() からは { "script:ld+json": data } で <head> に出す（buildPageMeta の jsonLd）。
 * 本文中に置きたいときは JsonLd コンポーネントを使う。
 */
import type { Lang } from "~/platform/i18n";
import { createAppPaths } from "../paths/app-paths";

export interface BreadcrumbItem {
  name: string;
  /** 言語に依存しないページパス */
  page: string;
  appPath?: string;
}

export function breadcrumbJsonLd(lang: Lang, items: BreadcrumbItem[], appPath = "") {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(createAppPaths(item.appPath ?? appPath).localizedPath(lang, item.page)),
    })),
  };
}

/** ツールページ */
export function webApplicationJsonLd(input: {
  lang: Lang;
  page: string;
  appPath?: string;
  name: string;
  description: string;
  /** 既定は画像系の "MultimediaApplication" */
  applicationCategory?: string;
  /** 既定は "Requires JavaScript and WebAssembly" */
  browserRequirements?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: input.name,
    description: input.description,
    url: absoluteUrl(createAppPaths(input.appPath ?? "").localizedPath(input.lang, input.page)),
    inLanguage: input.lang,
    applicationCategory: input.applicationCategory ?? "MultimediaApplication",
    operatingSystem: "Any",
    browserRequirements: input.browserRequirements ?? "Requires JavaScript and WebAssembly",
    offers: { "@type": "Offer", price: "0", priceCurrency: "JPY" },
  };
}

/** 解説ページ */
export function articleJsonLd(input: {
  lang: Lang;
  page: string;
  appPath?: string;
  headline: string;
  appName?: string;
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
    mainEntityOfPage: absoluteUrl(
      createAppPaths(input.appPath ?? "").localizedPath(input.lang, input.page),
    ),
    publisher: { "@type": "Organization", name: input.appName ?? SITE_NAME[input.lang] },
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
