/** ツールページの下に置く FAQ（FAQPage の JSON-LD は route.tsx の meta() で出す） */
import { FaqList } from "~/platform/ui/faq";
import { type TFunction, useSpeedI18n } from "../../i18n";

const FAQ_KEYS = [
  ["faq.q1", "faq.a1"],
  ["faq.q2", "faq.a2"],
  ["faq.q3", "faq.a3"],
  ["faq.q4", "faq.a4"],
] as const;

export function faqItems(t: TFunction) {
  return FAQ_KEYS.map(([q, a]) => ({ question: t(q), answer: t(a) }));
}

export function Faq() {
  const { t } = useSpeedI18n();
  return (
    <section aria-labelledby="st-faq-title" className="mt-12">
      <h2 id="st-faq-title" className="mb-3 text-xl font-semibold">
        {t("faq.title")}
      </h2>
      <FaqList items={faqItems(t)} />
    </section>
  );
}
