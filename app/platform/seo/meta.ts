/**
 * ページごとのメタ情報（plan.md §3.7, §9.1）。各ルートの meta() から buildPageMeta() を返す。
 * canonical・OGP・hreflang はすべて SITE_ORIGIN からの絶対 URL。
 */
import { appOgImagePaths } from "virtual:app-og-images";
import type { MetaDescriptor } from "react-router";
import { absoluteAssetUrl, absoluteUrl, SITE_NAME } from "~/platform/config";
import type { Lang } from "~/platform/i18n";
import { createT, DEFAULT_LANG, LANGS, OG_LOCALE, splitLangPath } from "~/platform/i18n";
import { createAppPaths } from "../paths/app-paths";
import { type BreadcrumbItem, breadcrumbJsonLd } from "./json-ld";

export interface PageMetaInput {
  lang: Lang;
  appPath?: string;
  appName?: string;
  /** 言語に依存しないページパス（例 "convert/png-to-webp"、トップは ""） */
  page: string;
  /** ページ名（"| サイト名" は自動で付ける） */
  title: string;
  description: string;
  ogType?: "website" | "article";
  /**
   * OGP 画像（アプリのパスからの相対パス、1200×630）。省略時は言語ごとの画像：そのページのアプリの
   * og/<lang>.png（app/apps/<id>/public/og/）、アプリが持っていなければサイト共通の og/<lang>.png
   * （public/og/）。生成は scripts/generate-og-images.ts。false なら付けない
   */
  image?: string | false;
  /** パンくず（トップは自動で先頭に付く）。省略時はトップ＋このページ */
  breadcrumbs?: BreadcrumbItem[];
  /** 追加の JSON-LD（WebApplication・Article・FAQPage 等） */
  jsonLd?: object[];
  noindex?: boolean;
}

/** OGP 画像の大きさ（px） */
export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;

/** 言語ごとの共通の OGP 画像（アプリのパス、またはサイトのルートからの相対パス） */
export function defaultOgImage(lang: Lang): string {
  return `og/${lang}.png`;
}

/** image 省略時の OGP 画像の絶対 URL（アプリの画像、無ければサイト共通の画像） */
export function defaultOgImageUrl(lang: Lang, appPath = ""): string {
  const dir = appPath && appOgImagePaths.includes(appPath) ? `${appPath}/` : "";
  return absoluteAssetUrl(`${dir}${defaultOgImage(lang)}`);
}

export function pageUrl(lang: Lang, page: string, appPath = ""): string {
  return absoluteUrl(createAppPaths(appPath).localizedPath(lang, page));
}

/** hreflang（ja / en / x-default=日本語版） */
export function alternateLinks(page: string, appPath = ""): MetaDescriptor[] {
  return [
    ...LANGS.map((l) => ({
      tagName: "link" as const,
      rel: "alternate",
      hrefLang: l,
      href: pageUrl(l, page, appPath),
    })),
    {
      tagName: "link" as const,
      rel: "alternate",
      hrefLang: "x-default",
      href: pageUrl(DEFAULT_LANG, page, appPath),
    },
  ];
}

export function fullTitle(title: string, name: string): string {
  return title.includes(name) ? title : `${title} | ${name}`;
}

export function buildPageMeta(input: PageMetaInput): MetaDescriptor[] {
  const { lang, page, description, ogType = "website", image, noindex } = input;
  const appPath = input.appPath ?? "";
  const name = input.appName ?? SITE_NAME[lang];
  const title = fullTitle(input.title, name);
  const url = pageUrl(lang, page, appPath);
  const imageUrl =
    image === false
      ? null
      : image === undefined
        ? defaultOgImageUrl(lang, appPath)
        : absoluteAssetUrl(`${appPath ? `${appPath}/` : ""}${image}`);

  const crumbs: BreadcrumbItem[] = [
    { name: SITE_NAME[lang], page: "", appPath: "" },
    ...(appPath ? [{ name, page: "", appPath }] : []),
    ...(input.breadcrumbs ?? (page ? [{ name: input.title, page }] : [])),
  ];

  const tags: MetaDescriptor[] = [
    { title },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: url },
    ...alternateLinks(page, appPath),
    { property: "og:type", content: ogType },
    { property: "og:site_name", content: name },
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
    { "script:ld+json": breadcrumbJsonLd(lang, crumbs, appPath) },
    ...(input.jsonLd ?? []).map((data) => ({ "script:ld+json": data })),
  ];
  if (imageUrl)
    tags.push(
      { property: "og:image", content: imageUrl },
      { property: "og:image:width", content: String(OG_IMAGE_SIZE.width) },
      { property: "og:image:height", content: String(OG_IMAGE_SIZE.height) },
      { property: "og:image:alt", content: name },
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
