import type { ReactNode } from "react";

/** ページ見出し（h1 ＋リード文）。各ルートの先頭に置く */
export function PageHeader({ title, lead }: { title: ReactNode; lead?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-2">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
      {lead && <p className="text-muted-foreground">{lead}</p>}
    </div>
  );
}
