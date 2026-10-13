/** 入力の上限（docs/markdown-pdf-plan.md §5） */

const MB = 1024 * 1024;

/** Markdown のテキスト（UTF-8 のバイト数） */
export const MAX_TEXT_BYTES = 2 * MB;
/** 一緒に入れる画像の合計サイズ */
export const MAX_IMAGE_TOTAL_BYTES = 20 * MB;
/** 一緒に入れる画像の枚数 */
export const MAX_IMAGE_COUNT = 50;

/** 読み込める文書ファイルの拡張子 */
export const TEXT_EXTENSIONS = [".md", ".markdown", ".txt"] as const;
/** 読み込める画像ファイルの拡張子（img 要素で表示できるもの） */
export const IMAGE_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".avif",
  ".svg",
] as const;
