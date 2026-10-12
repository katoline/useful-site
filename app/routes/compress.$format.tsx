import { NotFound } from "~/components/layout/NotFound";
import { PageHeader } from "~/components/layout/PageHeader";
import { faqJsonLd, webApplicationJsonLd } from "~/components/seo/json-ld";
import { buildPageMeta, metaContext } from "~/components/seo/meta";
import { ImageTool } from "~/components/tools/ImageTool";
import { faqFromDict } from "~/components/tools/ToolFaq";
import { useI18n } from "~/i18n";
import { type CompressFormat, FORMAT_LABEL, isCompressFormat } from "~/lib/site-routes";
import type { Route } from "./+types/compress.$format";

function label(format: string | undefined) {
  return isCompressFormat(format) ? { format: FORMAT_LABEL[format] } : null;
}

export function meta({ location, params }: Route.MetaArgs) {
  const { lang, page, t } = metaContext(location.pathname);
  const l = label(params.format);
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
      faqJsonLd(faqFromDict(t, `compress.faq.${params.format as CompressFormat}`)),
    ],
  });
}

/** 形式ごとの圧縮の入口ページ。出力は「元の形式のまま」、形式に合った説明・FAQ を置く */
export default function CompressFormatPage({ params }: Route.ComponentProps) {
  const { t } = useI18n();
  const l = label(params.format);
  if (!l || !isCompressFormat(params.format)) return <NotFound />;
  return (
    <>
      <PageHeader title={t("pages.compress.title", l)} lead={t("pages.compress.lead", l)} />
      <ImageTool
        settingsKey={`tool:compress:${params.format}`}
        initialSettings={{ output: "same" }}
        intro={t(`compress.intro.${params.format}`)}
        faq={faqFromDict(t, `compress.faq.${params.format}`)}
      />
    </>
  );
}
