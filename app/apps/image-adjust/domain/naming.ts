/**
 * 出力ファイル名・パスの組み立て。
 */
import { EXTENSION, type ImageFormat } from "./format";

/** 拡張子を除いたファイル名 */
export function stripExtension(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(0, i) : name;
}

/** "photo.png" → "photo.webp"。レスポンシブ出力は "photo-640w.webp" */
export function outputFileName(
  inputName: string,
  format: ImageFormat,
  variantWidth: number | null = null,
): string {
  const base = stripExtension(inputName);
  const suffix = variantWidth ? `-${variantWidth}w` : "";
  return `${base}${suffix}.${EXTENSION[format]}`;
}

/** "photos/a/photo.png" → "photos/a/photo.webp"（フォルダ構成を保つ） */
export function outputPath(
  inputPath: string,
  format: ImageFormat,
  variantWidth: number | null = null,
): string {
  const i = inputPath.lastIndexOf("/");
  const dir = i >= 0 ? inputPath.slice(0, i + 1) : "";
  const name = i >= 0 ? inputPath.slice(i + 1) : inputPath;
  return dir + outputFileName(name, format, variantWidth);
}

/** ファイル名に使えない文字（Windows の禁止文字・パス区切り）と制御文字を _ にする（URL 入力の保存名と同じ規則） */
const UNSAFE_FILENAME_CHARS = new Set([...'<>:"/\\|?*']);

export function sanitizeFileName(name: string): string {
  let out = "";
  for (const ch of name) {
    const code = ch.codePointAt(0) ?? 0;
    out += code < 0x20 || code === 0x7f || UNSAFE_FILENAME_CHARS.has(ch) ? "_" : ch;
  }
  const trimmed = out.trim().replace(/^\.+/, "");
  return trimmed || "image";
}

/** 相対パスの各セグメントを sanitize する（区切りの / は残す） */
export function sanitizePath(path: string): string {
  return path
    .split("/")
    .filter((s) => s.length > 0)
    .map((s) => sanitizeFileName(s))
    .join("/");
}

/** 削減率（%）。負なら大きくなった */
export function reductionPercent(before: number, after: number): number {
  if (before <= 0) return 0;
  return Math.round(((before - after) / before) * 1000) / 10;
}
