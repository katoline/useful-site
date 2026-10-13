import {
  type PageMetaInput,
  alternateLinks as platformAlternateLinks,
  buildPageMeta as platformBuildPageMeta,
  fullTitle as platformFullTitle,
  pageUrl as platformPageUrl,
} from "~/platform/seo/meta";
import type { Lang } from "../../i18n";
import { createT, splitLangPath } from "../../i18n";
import { manifest } from "../../manifest";

export { defaultOgImage, OG_IMAGE_SIZE, type PageMetaInput } from "~/platform/seo/meta";
export function buildPageMeta(input: PageMetaInput) {
  return platformBuildPageMeta({
    ...input,
    appPath: manifest.path,
    appName: manifest.name[input.lang],
  });
}
export function pageUrl(lang: Lang, page: string) {
  return platformPageUrl(lang, page, manifest.path);
}
export function alternateLinks(page: string) {
  return platformAlternateLinks(page, manifest.path);
}
export function fullTitle(title: string) {
  return platformFullTitle(title, manifest.name.ja);
}
export function metaContext(pathname: string) {
  const { lang, page } = splitLangPath(pathname);
  return { lang, page, t: createT(lang) };
}
