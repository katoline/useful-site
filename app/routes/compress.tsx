import { useLocation } from "react-router";
import { NotFound } from "~/components/layout/NotFound";
import { PageHeader } from "~/components/layout/PageHeader";
import { faqJsonLd, webApplicationJsonLd } from "~/components/seo/json-ld";
import { buildPageMeta, metaContext } from "~/components/seo/meta";
import { ImageTool } from "~/components/tools/ImageTool";
import { faqFromDict } from "~/components/tools/ToolFaq";
import { useI18n } from "~/i18n";
import { type CompressFormat, FORMAT_LABEL, isCompressFormat, pageParam } from "~/lib/site-routes";
import type { Route } from "./+types/compress";

/** 形式（app/routes.ts が COMPRESS_FORMATS の値ごとに登録する静的ルート）。パスから取り出す */
function formatFrom(pathname: string): CompressFormat | undefined {
  const format = pageParam(pathname, "compress");
  return isCompressFormat(format) ? format : undefined;
}

export function meta({ location }: Route.MetaArgs) {
  const { lang, page, t } = metaContext(location.pathname);
  const format = formatFrom(location.pathname);
  const l = format && { format: FORMAT_LABEL[format] };
  if (!l) return [{ title: t("errors.notFoundTitle") }, { name: "robots", content: "noindex" }];
  const title = t("pages.compress.title", l);
  const description = t("pages.compress.description", l);
  return buildPageMeta({
    lang,
    page,
    title: t("pages.compress.metaTitle", l),
    description,
    breadcrumbs: [{ name: title, page }],
    jsonLd: [
      webApplicationJsonLd({ lang, page, name: title, description }),
      faqJsonLd(faqFromDict(t, `compress.faq.${format}`)),
    ],
  });
}

/** 形式ごとの圧縮の入口ページ。出力は「元の形式のまま」、形式に合った説明・FAQ を置く */
export default function CompressFormatPage() {
  const { t } = useI18n();
  const format = formatFrom(useLocation().pathname);
  if (!format) return <NotFound />;
  const l = { format: FORMAT_LABEL[format] };
  return (
    <>
      <PageHeader title={t("pages.compress.title", l)} lead={t("pages.compress.lead", l)} />
      <ImageTool
        settingsKey={`tool:compress:${format}`}
        initialSettings={{ output: "same" }}
        intro={t(`compress.intro.${format}`)}
        faq={faqFromDict(t, `compress.faq.${format}`)}
      />
    </>
  );
}
