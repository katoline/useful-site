/** ツールページの下に置く FAQ（FAQPage の JSON-LD は route.tsx の meta() で出す） */
import { type TFunction, useMdI18n } from "../../i18n";

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
  const { t } = useMdI18n();
  return (
    <section aria-labelledby="md-faq-title" className="mt-12">
      <h2 id="md-faq-title" className="mb-3 text-xl font-semibold">
        {t("faq.title")}
      </h2>
      <dl className="divide-y divide-border">
        {faqItems(t).map((item) => (
          <div key={item.question} className="py-3">
            <dt className="font-medium">{item.question}</dt>
            <dd className="mt-1 text-sm text-muted-foreground">{item.answer}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
