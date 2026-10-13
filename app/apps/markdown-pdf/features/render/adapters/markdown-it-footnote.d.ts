// markdown-it-footnote は型定義を同梱していない（@types は markdown-it 14 の型に依存するので使わない）
declare module "markdown-it-footnote" {
  import type { MarkdownIt } from "markdown-it";
  export default function footnote(md: MarkdownIt): void;
}
