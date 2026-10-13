import { useLocation } from "react-router";
import { NotFound } from "~/platform/shell/NotFound";
import { PageHeader } from "~/platform/shell/PageHeader";
import {
  type ConvertPair,
  FORMAT_LABEL,
  isConvertPair,
  parseConvertPair,
} from "../../domain/pages";
import { faqFromDict, ImageTool } from "../../features/image-processing";
import { remoteImageLoader } from "../../features/remote-image";
import { useI18n } from "../../i18n";
import { faqJsonLd, webApplicationJsonLd } from "../../shared/seo/json-ld";
import { buildPageMeta, metaContext } from "../../shared/seo/meta";
import { pageParam } from "../../shared/site-routes";
import type { Route } from "./+types/route";

/**
 * 変換方向（app/apps/image-adjust/routes.ts が CONVERT_PAIRS の値ごとに登録する静的ルート。app/routes.ts が規約で集める）。パスから取り出す
 */
function pairFrom(pathname: string): ConvertPair | undefined {
  const pair = pageParam(pathname, "convert");
  return isConvertPair(pair) ? pair : undefined;
}

function labels(pair: ConvertPair) {
  const { from, to } = parseConvertPair(pair);
  return { from: FORMAT_LABEL[from], to: FORMAT_LABEL[to] };
}

export function meta({ location }: Route.MetaArgs) {
  const { lang, page, t } = metaContext(location.pathname);
  const pair = pairFrom(location.pathname);
  const l = pair && labels(pair);
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
      faqJsonLd(faqFromDict(t, `convert.faq.${pair}`)),
    ],
  });
}

/** 変換方向ごとの入口ページ（§3.7）。出力形式の初期値を変えたツール＋専用の説明・FAQ */
export default function ConvertPairPage() {
  const { t } = useI18n();
  const pair = pairFrom(useLocation().pathname);
  if (!pair) return <NotFound />;
  const l = labels(pair);
  const { to } = parseConvertPair(pair);
  return (
    <>
      <PageHeader title={t("pages.convert.title", l)} lead={t("pages.convert.lead", l)} />
      <ImageTool
        settingsKey={`tool:convert:${pair}`}
        initialSettings={{ output: to === "gif" || to === "svg" ? "same" : to }}
        intro={t(`convert.intro.${pair}`)}
        faq={faqFromDict(t, `convert.faq.${pair}`)}
        remoteImage={remoteImageLoader}
      />
    </>
  );
}
