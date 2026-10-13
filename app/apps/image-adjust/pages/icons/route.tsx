import { PageHeader } from "~/platform/shell/PageHeader";
import { IconTool } from "../../features/icon-generator";
import { type TFunction, useI18n } from "../../i18n";
import { faqJsonLd, webApplicationJsonLd } from "../../shared/seo/json-ld";
import { buildPageMeta, metaContext } from "../../shared/seo/meta";
import type { Route } from "./+types/route";

const FAQ_NUMBERS = [1, 2, 3, 4] as const;
const HOWTO_STEPS = [1, 2, 3, 4] as const;

function faqItems(t: TFunction) {
  return FAQ_NUMBERS.map((n) => ({
    question: t(`icons.faq.q${n}`),
    answer: t(`icons.faq.a${n}`),
  }));
}

export function meta({ location }: Route.MetaArgs) {
  const { lang, page, t } = metaContext(location.pathname);
  const description = t("pages.icons.description");
  return buildPageMeta({
    lang,
    page,
    title: t("pages.icons.metaTitle"),
    description,
    breadcrumbs: [{ name: t("pages.icons.title"), page }],
    jsonLd: [
      webApplicationJsonLd({ lang, page, name: t("pages.icons.title"), description }),
      faqJsonLd(faqItems(t)),
    ],
  });
}

/** アイコン生成ツール（plan.md §2.4・フェーズ 8） */
export default function Icons() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader title={t("pages.icons.title")} lead={t("pages.icons.lead")} />
      <IconTool>
        <section className="mt-12 flex flex-col gap-4" aria-labelledby="icons-howto">
          <h2 id="icons-howto" className="text-xl font-semibold">
            {t("icons.howto.title")}
          </h2>
          <ol className="flex list-decimal flex-col gap-2 pl-6">
            {HOWTO_STEPS.map((n) => (
              <li key={n}>{t(`icons.howto.step${n}`)}</li>
            ))}
          </ol>
        </section>

        <section className="mt-12 flex flex-col gap-4" aria-labelledby="icons-faq">
          <h2 id="icons-faq" className="text-xl font-semibold">
            {t("icons.faq.title")}
          </h2>
          <dl className="flex flex-col gap-4">
            {faqItems(t).map((item) => (
              <div key={item.question} className="flex flex-col gap-1">
                <dt className="font-medium">{item.question}</dt>
                <dd className="text-muted-foreground">{item.answer}</dd>
              </div>
            ))}
          </dl>
        </section>
      </IconTool>
    </>
  );
}
