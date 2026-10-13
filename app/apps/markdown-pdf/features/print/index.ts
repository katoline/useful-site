/** print：設定 → 印刷用の文書、保存名の決定、iframe からの印刷（feature の外からはここだけを import する） */
export { PREVIEW_SANDBOX } from "./adapters/frame";
export {
  buildDocumentCss,
  buildPageRule,
  buildPrintDocument,
  PREVIEW_CSP,
  type PrintDocumentInput,
} from "./core/document";
export { documentTitle, extractFirstHeading, markdownFileName, toFileName } from "./core/file-name";
export { PreviewFrame, type PreviewFrameHandle } from "./ui/PreviewFrame";
export { PrintHelp } from "./ui/PrintHelp";
