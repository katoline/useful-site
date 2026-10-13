import {
  articleJsonLd as platformArticleJsonLd,
  breadcrumbJsonLd as platformBreadcrumbJsonLd,
  webApplicationJsonLd as platformWebApplicationJsonLd,
} from "~/platform/seo/json-ld";
import { manifest } from "../manifest";

export { type BreadcrumbItem, faqJsonLd, serializeJsonLd } from "~/platform/seo/json-ld";
export function webApplicationJsonLd(input: Parameters<typeof platformWebApplicationJsonLd>[0]) {
  return platformWebApplicationJsonLd({ ...input, appPath: manifest.path });
}
export function articleJsonLd(input: Parameters<typeof platformArticleJsonLd>[0]) {
  return platformArticleJsonLd({
    ...input,
    appPath: manifest.path,
    appName: manifest.name[input.lang],
  });
}
export function breadcrumbJsonLd(...[lang, items]: Parameters<typeof platformBreadcrumbJsonLd>) {
  return platformBreadcrumbJsonLd(lang, items, manifest.path);
}
