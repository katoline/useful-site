/**
 * 設定 → 印刷用の CSS と、プレビュー・印刷に使う HTML 文書（iframe の srcdoc）を作る（純粋関数）。
 *
 * - 画面（プレビュー）：用紙の幅の「紙風」表示。狭い画面では幅に合わせて流し込む
 * - 印刷：@page で用紙・向き・余白を指定し、常に白地に黒。`---` で改ページ（設定でオン・オフ）。
 *   見出しの直後・表の行・コード・画像はなるべく分断しない
 * - 文書の先頭に CSP の meta を置き、外部への通信を一切させない（docs/markdown-pdf-plan.md §5）
 */
import {
  type DocumentSettings,
  type FontFamily,
  MARGIN_MM,
  pageDimensions,
} from "../../../domain/document-settings";

/** iframe の中の CSP。画像は data: と blob:（一緒に入れた画像）だけ、スタイルは文書内のものだけ */
export const PREVIEW_CSP = "default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'";

/** システムフォントだけを使う（Web フォントは配らない） */
export const FONT_STACKS: Record<FontFamily, string> = {
  gothic:
    '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", YuGothic, Meiryo, "Noto Sans JP", "Noto Sans CJK JP", system-ui, sans-serif',
  mincho:
    '"Hiragino Mincho ProN", "Yu Mincho", YuMincho, "MS PMincho", "Noto Serif JP", "Noto Serif CJK JP", serif',
};
const MONO_STACK =
  'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", "Noto Sans Mono", monospace';

/** @page（用紙・向き・余白） */
export function buildPageRule(settings: DocumentSettings): string {
  const size = settings.paper === "a4" ? "A4" : "letter";
  return `@page { size: ${size} ${settings.orientation}; margin: ${MARGIN_MM[settings.margin]}mm; }`;
}

/** `---` の改ページ。脚注の区切り線（hr.footnotes-sep）では改ページしない */
export function buildPageBreakRules(settings: DocumentSettings): string {
  if (!settings.pageBreakOnRule) return "";
  return [
    "@media print {",
    "  hr:not(.footnotes-sep) { break-after: page; page-break-after: always; height: 0; margin: 0; border: 0; visibility: hidden; }",
    "}",
    "@media screen {",
    "  hr:not(.footnotes-sep) { border: 0; border-top: 2px dashed #9ca3af; margin: 2em 0; }",
    "}",
  ].join("\n");
}

export function buildDocumentCss(settings: DocumentSettings): string {
  const { width, height } = pageDimensions(settings.paper, settings.orientation);
  const margin = MARGIN_MM[settings.margin];
  return [
    buildPageRule(settings),
    ":root { color-scheme: light; }",
    "* { -webkit-print-color-adjust: exact; print-color-adjust: exact; }",
    `html { background: #e5e7eb; }`,
    `body { box-sizing: border-box; width: ${width}mm; min-height: ${height}mm; margin: 16px auto; padding: ${margin}mm; background: #fff; color: #111; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25); font-family: ${FONT_STACKS[settings.fontFamily]}; font-size: ${settings.fontSize}pt; line-height: 1.7; overflow-wrap: anywhere; }`,
    `@media screen and (max-width: ${width}mm) { html { background: #fff; } body { width: auto; min-height: 0; margin: 0; padding: 16px; box-shadow: none; } }`,
    "@media print { html { background: none; } body { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; } a { color: inherit; } }",
    "body > :first-child { margin-top: 0; }",
    "h1, h2, h3, h4, h5, h6 { line-height: 1.35; margin: 1.4em 0 0.6em; break-after: avoid; page-break-after: avoid; break-inside: avoid; }",
    "h1 { font-size: 1.9em; border-bottom: 1px solid #d0d0d0; padding-bottom: 0.2em; }",
    "h2 { font-size: 1.45em; border-bottom: 1px solid #e0e0e0; padding-bottom: 0.15em; }",
    "h3 { font-size: 1.2em; } h4 { font-size: 1.05em; } h5, h6 { font-size: 1em; }",
    "p, ul, ol, dl, table, pre, blockquote { margin: 0 0 1em; }",
    "li > ul, li > ol { margin-bottom: 0; }",
    "a { color: #0b57d0; }",
    "hr { border: 0; border-top: 1px solid #ccc; margin: 1.5em 0; }",
    "table { border-collapse: collapse; max-width: 100%; }",
    "th, td { border: 1px solid #999; padding: 0.3em 0.6em; vertical-align: top; }",
    "th { background: #f0f0f0; font-weight: 600; }",
    "thead { display: table-header-group; }",
    "tr, img, pre, blockquote, figure { break-inside: avoid; page-break-inside: avoid; }",
    `code, kbd, pre, samp { font-family: ${MONO_STACK}; font-size: 0.9em; }`,
    "code { background: #f2f3f5; padding: 0.1em 0.3em; border-radius: 3px; }",
    "pre { background: #f6f8fa; border: 1px solid #e1e4e8; padding: 0.8em 1em; border-radius: 4px; white-space: pre-wrap; overflow-wrap: anywhere; }",
    "pre code { background: none; padding: 0; font-size: 1em; }",
    "blockquote { margin-left: 0; padding: 0 1em; border-left: 4px solid #ccc; color: #444; }",
    "img { max-width: 100%; height: auto; }",
    ".task-list-container { padding-left: 1.4em; }",
    ".task-list-item { list-style: none; }",
    ".task-list-item-checkbox { margin: 0 0.45em 0 -1.4em; vertical-align: middle; }",
    ".footnotes { font-size: 0.9em; }",
    ".footnotes-sep { margin-top: 2em; }",
    ".md-blocked-image { display: inline-block; border: 1px dashed #999; padding: 0.1em 0.5em; color: #555; font-size: 0.9em; }",
    buildPageBreakRules(settings),
  ]
    .filter(Boolean)
    .join("\n");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface PrintDocumentInput {
  /** 本文の HTML（render が作った、エスケープ済みのもの） */
  bodyHtml: string;
  settings: DocumentSettings;
  /** 文書のタイトル（PDF の保存名の初期値になる） */
  title: string;
  lang: "ja" | "en";
}

/** iframe の srcdoc に入れる HTML 文書。CSP の meta は head の先頭に置く（それより後の要素にだけ効くため） */
export function buildPrintDocument({
  bodyHtml,
  settings,
  title,
  lang,
}: PrintDocumentInput): string {
  return [
    "<!doctype html>",
    `<html lang="${lang}">`,
    "<head>",
    `<meta http-equiv="Content-Security-Policy" content="${PREVIEW_CSP}">`,
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="referrer" content="no-referrer">',
    `<title>${escapeHtml(title)}</title>`,
    `<style>\n${buildDocumentCss(settings)}\n</style>`,
    "</head>",
    "<body>",
    bodyHtml,
    "</body>",
    "</html>",
  ].join("\n");
}
