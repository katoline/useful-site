import { ImageTool } from "~/apps/image-adjust/components/tools/ImageTool";
import { faqFromDict } from "~/apps/image-adjust/components/tools/ToolFaq";
import { useI18n } from "~/apps/image-adjust/i18n";
import { faqJsonLd, webApplicationJsonLd } from "~/apps/image-adjust/seo/json-ld";
import { buildPageMeta, metaContext } from "~/apps/image-adjust/seo/meta";
import { PageHeader } from "~/platform/shell/PageHeader";
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
