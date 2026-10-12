import { NotFound } from "~/components/layout/NotFound";
import { PageHeader } from "~/components/layout/PageHeader";
import { faqJsonLd, webApplicationJsonLd } from "~/components/seo/json-ld";
import { buildPageMeta, metaContext } from "~/components/seo/meta";
import { ImageTool } from "~/components/tools/ImageTool";
import { faqFromDict } from "~/components/tools/ToolFaq";
import { useI18n } from "~/i18n";
import { type ConvertPair, FORMAT_LABEL, isConvertPair, parseConvertPair } from "~/lib/site-routes";
import type { Route } from "./+types/convert.$pair";

function labels(pair: string | undefined) {
  if (!isConvertPair(pair)) return null;
  const { from, to } = parseConvertPair(pair);
  return { from: FORMAT_LABEL[from], to: FORMAT_LABEL[to] };
}

export function meta({ location, params }: Route.MetaArgs) {
  const { lang, page, t } = metaContext(location.pathname);
  const l = labels(params.pair);
  if (!l) return [{ title: t("errors.notFoundTitle") }, { name: "robots", content: "noindex" }];
  const title = t("pages.convert.title", l);
  const description = t("pages.convert.description", l);
  return buildPageMeta({
    lang,
    page,
    title: t("pages.convert.metaTitle", l),
    description,
    breadcrumbs: [{ name: title, page }],
    jsonLd: [
      webApplicationJsonLd({ lang, page, name: title, description }),
      faqJsonLd(faqFromDict(t, `convert.faq.${params.pair as ConvertPair}`)),
    ],
  });
}

/** 変換方向ごとの入口ページ（§3.7）。出力形式の初期値を変えたツール＋専用の説明・FAQ */
export default function ConvertPairPage({ params }: Route.ComponentProps) {
  const { t } = useI18n();
  const l = labels(params.pair);
  if (!l || !isConvertPair(params.pair)) return <NotFound />;
  const { to } = parseConvertPair(params.pair);
  return (
    <>
      <PageHeader title={t("pages.convert.title", l)} lead={t("pages.convert.lead", l)} />
      <ImageTool
        settingsKey={`tool:convert:${params.pair}`}
        initialSettings={{ output: to === "gif" || to === "svg" ? "same" : to }}
        intro={t(`convert.intro.${params.pair}`)}
        faq={faqFromDict(t, `convert.faq.${params.pair}`)}
      />
    </>
  );
}
