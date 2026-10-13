/** document-input：テキスト・.md・画像ファイルの読み込みと上限の検査（feature の外からはここだけを import する） */
export { downloadText, draftStorage, readTextFile, useObjectUrls } from "./adapters/files";
export {
  acceptImages,
  checkTextFile,
  classifyFiles,
  isTextWithinLimit,
  mergeImages,
} from "./core/validate";
export { FilePickerButton } from "./ui/FilePickerButton";
export { ImageList } from "./ui/ImageList";
export { MarkdownEditor } from "./ui/MarkdownEditor";
