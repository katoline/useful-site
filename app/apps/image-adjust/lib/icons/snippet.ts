/**
 * <head> に貼る HTML スニペット（純粋関数）。
 */
import { type IconSettings, sanitizeIconSettings } from "./settings";
import { FILE_NAMES } from "./specs";

export interface SnippetOptions {
  /** favicon.svg を含めるか（元画像が SVG のとき） */
  hasSvg: boolean;
}

/** 属性値に入れる文字列をエスケープする */
export function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildHeadSnippet(input: IconSettings, options: SnippetOptions): string {
  const s = sanitizeIconSettings(input);
  const href = (file: string) => escapeHtmlAttr(`${s.basePath}${file}`);
  const lines = [
    `<link rel="icon" href="${href(FILE_NAMES.ico)}" sizes="48x48">`,
    ...(options.hasSvg
      ? [`<link rel="icon" href="${href(FILE_NAMES.svg)}" type="image/svg+xml">`]
      : []),
    `<link rel="icon" href="${href("favicon-32x32.png")}" sizes="32x32" type="image/png">`,
    `<link rel="icon" href="${href("favicon-16x16.png")}" sizes="16x16" type="image/png">`,
    `<link rel="apple-touch-icon" href="${href("apple-touch-icon.png")}">`,
    `<link rel="manifest" href="${href(FILE_NAMES.manifest)}">`,
    `<meta name="theme-color" content="${escapeHtmlAttr(s.themeColor)}">`,
  ];
  if (s.includeOg) {
    // og:image は絶対 URL が必要。設置先が相対パスのときはドメインを補ってもらう
    lines.push(`<meta property="og:image" content="${href("og-image.png")}">`);
    lines.push(`<meta property="og:image:width" content="1200">`);
    lines.push(`<meta property="og:image:height" content="630">`);
  }
  return `${lines.join("\n")}\n`;
}

/** 設置先が絶対 URL（https:// 等）か。og:image の注意書きに使う */
export function isAbsoluteUrl(basePath: string): boolean {
  return /^https?:\/\//i.test(basePath.trim());
}
