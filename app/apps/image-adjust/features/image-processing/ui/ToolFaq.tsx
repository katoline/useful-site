/**
 * ツールページの下に置く「使い方」と FAQ（§2.6）。FAQPage の JSON-LD は各ルートの meta() で出す。
 */
import { type DictKey, useI18n } from "../../../i18n";

export interface FaqItem {
  question: string;
  answer: string;
}

/** 辞書の "<prefix>.q1" / "<prefix>.a1" … を FAQ の配列にする */
export function faqFromDict(t: (key: DictKey) => string, prefix: string, count = 3): FaqItem[] {
  const items: FaqItem[] = [];
  for (let i = 1; i <= count; i++) {
    items.push({
      question: t(`${prefix}.q${i}` as DictKey),
      answer: t(`${prefix}.a${i}` as DictKey),
    });
  }
  return items;
}

export function ToolFaq({ intro, faq }: { intro?: string; faq: FaqItem[] }) {
  const { t } = useI18n();
  const steps = ["1", "2", "3"] as const;
  return (
    <section className="mt-12 flex flex-col gap-8" aria-labelledby="tool-howto">
      {intro && <p className="text-muted-foreground">{intro}</p>}
      <div>
        <h2 id="tool-howto" className="mb-3 text-xl font-semibold">
          {t("tool.faq.howTo")}
        </h2>
        <ol className="list-decimal space-y-1 pl-6 text-sm text-muted-foreground">
          {steps.map((n) => (
            <li key={n}>{t(`tool.faq.steps.${n}`)}</li>
          ))}
        </ol>
      </div>
      <div>
        <h2 className="mb-3 text-xl font-semibold">{t("tool.faq.title")}</h2>
        <dl className="divide-y divide-border">
          {faq.map((item) => (
            <div key={item.question} className="py-3">
              <dt className="font-medium">{item.question}</dt>
              <dd className="mt-1 text-sm text-muted-foreground">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
