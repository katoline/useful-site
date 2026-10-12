import { PageHeader } from "~/components/layout/PageHeader";
import { faqJsonLd, webApplicationJsonLd } from "~/components/seo/json-ld";
import { buildPageMeta, metaContext } from "~/components/seo/meta";
import { ImageTool } from "~/components/tools/ImageTool";
import { faqFromDict } from "~/components/tools/ToolFaq";
import { useI18n } from "~/i18n";
import type { Route } from "./+types/home";

export function meta({ location }: Route.MetaArgs) {
  const { lang, page, t } = metaContext(location.pathname);
  const description = t("pages.home.description");
  return buildPageMeta({
    lang,
    page,
    title: t("pages.home.metaTitle"),
    description,
    jsonLd: [
      webApplicationJsonLd({ lang, page, name: t("pages.home.title"), description }),
      faqJsonLd(faqFromDict(t, "tool.faq.home")),
    ],
  });
}

/** 変換・圧縮ツール（トップ）。出力形式は「元の形式のまま」から始める */
export default function Home() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader title={t("pages.home.title")} lead={t("pages.home.lead")} />
      <ImageTool settingsKey="tool:home" faq={faqFromDict(t, "tool.faq.home")} />
    </>
  );
}
