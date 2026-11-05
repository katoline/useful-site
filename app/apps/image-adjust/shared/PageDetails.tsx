/**
 * 変換・圧縮の入口ページの下に置く、そのページ専用の解説（h2 ＋ h3 の小見出し）と関連ガイドへのリンク。
 * ツール（入力・設定・保存）とは離して、ツールの後ろに置く。本文の段落は "\n\n" で区切る。
 */
import { LocalizedLink } from "~/platform/shell/LocalizedLink";

export interface PageDetailsSection {
  title: string;
  body: string;
}

export interface PageDetailsProps {
  /** h2 の id（aria-labelledby 用） */
  id: string;
  title: string;
  sections: readonly PageDetailsSection[];
  /** 関連ガイド：導入文・ページパス（言語なし。例 "guide/image-formats"）・リンクの文言 */
  guide: { lead: string; page: string; label: string };
}

export function PageDetails({ id, title, sections, guide }: PageDetailsProps) {
  return (
    <section className="mt-12 flex max-w-3xl flex-col gap-6" aria-labelledby={id}>
      <h2 id={id} className="text-xl font-semibold">
        {title}
      </h2>
      {sections.map((section) => (
        <div key={section.title} className="flex flex-col gap-2">
          <h3 className="text-lg font-semibold">{section.title}</h3>
          {section.body.split("\n\n").map((paragraph) => (
            <p key={paragraph} className="leading-7 text-muted-foreground">
              {paragraph}
            </p>
          ))}
        </div>
      ))}
      <p className="text-sm text-muted-foreground">
        {guide.lead}{" "}
        <LocalizedLink
          page={guide.page}
          className="font-medium text-foreground underline underline-offset-4 hover:decoration-2"
        >
          {guide.label}
        </LocalizedLink>
      </p>
    </section>
  );
}
