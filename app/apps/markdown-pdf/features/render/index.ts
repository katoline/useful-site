/** render：Markdown → 安全な HTML（feature の外からはここだけを import する） */
export { createMarkdownItRenderer } from "./adapters/markdown-it-renderer";
export type { LoadRenderer, MarkdownRenderer, RenderOptions } from "./core/port";
export {
  type ImageResolution,
  isAllowedUrl,
  normalizeImagePath,
  resolveImageSource,
} from "./core/url-policy";
