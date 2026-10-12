/**
 * ページごとのメタ情報（plan.md §3.7, §9.1）。各ルートの meta() から buildPageMeta() を返す。
 * canonical・OGP・hreflang はすべて SITE_ORIGIN からの絶対 URL。
 */
import type { MetaDescriptor } from "react-router";
import type { Lang } from "~/i18n";
import { createT, DEFAULT_LANG, LANGS, localizedPath, OG_LOCALE, splitLangPath } from "~/i18n";
import { absoluteAssetUrl, absoluteUrl, SITE_NAME } from "~/lib/config";
import { type BreadcrumbItem, breadcrumbJsonLd } from "./json-ld";

export interface PageMetaInput {
  lang: Lang;
  /** 言語に依存しないページパス（例 "convert/png-to-webp"、トップは ""） */
  page: string;
  /** ページ名（"| サイト名" は自動で付ける） */
  title: string;
  description: string;
  ogType?: "website" | "article";
  /**
   * OGP 画像（BASE_PATH からの相対パス、1200×630）。省略時は言語ごとの共通画像（public/og/<lang>.png。
   * scripts/generate-og-images.ts で生成）
   */
  image?: string;
  /** パンくず（トップは自動で先頭に付く）。省略時はトップ＋このページ */
  breadcrumbs?: BreadcrumbItem[];
  /** 追加の JSON-LD（WebApplication・Article・FAQPage 等） */
  jsonLd?: object[];
  noindex?: boolean;
}

/** OGP 画像の大きさ（px） */
export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;

/** 言語ごとの共通の OGP 画像（BASE_PATH からの相対パス） */
export function defaultOgImage(lang: Lang): string {
  return `og/${lang}.png`;
}

export function pageUrl(lang: Lang, page: string): string {
  return absoluteUrl(localizedPath(lang, page));
}

/** hreflang（ja / en / x-default=日本語版） */
export function alternateLinks(page: string): MetaDescriptor[] {
  return [
    ...LANGS.map((l) => ({
      tagName: "link" as const,
      rel: "alternate",
      hrefLang: l,
      href: pageUrl(l, page),
    })),
    {
      tagName: "link" as const,
      rel: "alternate",
      hrefLang: "x-default",
      href: pageUrl(DEFAULT_LANG, page),
    },
  ];
}

export function fullTitle(title: string): string {
  return title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
}

export function buildPageMeta(input: PageMetaInput): MetaDescriptor[] {
  const { lang, page, description, ogType = "website", image, noindex } = input;
  const t = createT(lang);
  const title = fullTitle(input.title);
  const url = pageUrl(lang, page);
  const imageUrl = absoluteAssetUrl(image ?? defaultOgImage(lang));

  const crumbs: BreadcrumbItem[] = [
    { name: t("nav.home"), page: "" },
    ...(input.breadcrumbs ?? (page ? [{ name: input.title, page }] : [])),
  ];

  const tags: MetaDescriptor[] = [
    { title },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: url },
    ...alternateLinks(page),
    { property: "og:type", content: ogType },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:url", content: url },
    { property: "og:locale", content: OG_LOCALE[lang] },
    ...LANGS.filter((l) => l !== lang).map((l) => ({
      property: "og:locale:alternate",
      content: OG_LOCALE[l],
    })),
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { "script:ld+json": breadcrumbJsonLd(lang, crumbs) },
    ...(input.jsonLd ?? []).map((data) => ({ "script:ld+json": data })),
  ];
  tags.push(
    { property: "og:image", content: imageUrl },
    { property: "og:image:width", content: String(OG_IMAGE_SIZE.width) },
    { property: "og:image:height", content: String(OG_IMAGE_SIZE.height) },
    { property: "og:image:alt", content: SITE_NAME },
    { name: "twitter:image", content: imageUrl },
  );
  if (noindex) tags.push({ name: "robots", content: "noindex" });
  return tags;
}

/** meta() の location.pathname から言語とページパスを得る */
export function metaContext(pathname: string): {
  lang: Lang;
  page: string;
  t: ReturnType<typeof createT>;
} {
  const { lang, page } = splitLangPath(pathname);
  return { lang, page, t: createT(lang) };
}
