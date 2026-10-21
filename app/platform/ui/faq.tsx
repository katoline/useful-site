/**
 * 開閉式の FAQ（<details> / <summary>）。既定は閉じる。
 * 回答は文字列でも JSX でもよい（リンク等を含む場合がある）。FAQPage の JSON-LD は各ページの meta() で別に出す。
 */
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "~/platform/utils";

export interface FaqEntry {
  /** 一意な質問文（<details> の key にも使う） */
  question: string;
  answer: ReactNode;
}

export interface FaqListProps {
  items: readonly FaqEntry[];
  className?: string;
}

export function FaqList({ items, className }: FaqListProps) {
  return (
    <div className={cn("divide-y divide-border border-y border-border", className)}>
      {items.map((item) => (
        <details key={item.question} className="group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-3 font-medium select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden">
            <span>{item.question}</span>
            <ChevronDown
              aria-hidden
              className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="pb-3 text-sm text-muted-foreground">{item.answer}</div>
        </details>
      ))}
    </div>
  );
}
