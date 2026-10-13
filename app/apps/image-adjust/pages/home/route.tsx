import { PageHeader } from "~/platform/shell/PageHeader";
import { faqFromDict, ImageTool } from "../../features/image-processing";
import { remoteImageLoader } from "../../features/remote-image";
import { useI18n } from "../../i18n";
import { faqJsonLd, webApplicationJsonLd } from "../../shared/seo/json-ld";
import { buildPageMeta, metaContext } from "../../shared/seo/meta";
import type { Route } from "./+types/route";

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
      <ImageTool
        settingsKey="tool:home"
        faq={faqFromDict(t, "tool.faq.home")}
        remoteImage={remoteImageLoader}
      />
    </>
  );
}
