/** render：Markdown → 安全な HTML（feature の外からはここだけを import する） */
export { createMarkdownItRenderer } from "./adapters/markdown-it-renderer";
export type { MarkdownRenderer } from "./core/port";
