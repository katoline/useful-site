/**
 * 画像形式の判定（先頭バイトのマジックナンバー）と、形式ごとの MIME・拡張子。
 * ブラウザの File.type は拡張子由来で当てにならないので、中身で判定する。
 */

export type ImageFormat = "png" | "jpeg" | "webp" | "gif" | "svg";
/** ピクセルにデコードして再エンコードできる形式（相互変換の対象） */
export type RasterFormat = "png" | "jpeg" | "webp";

export const RASTER_FORMATS: readonly RasterFormat[] = ["png", "jpeg", "webp"];
export const IMAGE_FORMATS: readonly ImageFormat[] = ["png", "jpeg", "webp", "gif", "svg"];
/** 通常のファイル入力と共有受け取りで受け付ける ZIP の MIME */
export const ZIP_MIME_TYPES: readonly string[] = [
  "application/zip",
  "application/x-zip-compressed",
];

export const MIME_TYPE: Record<ImageFormat, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
};

export const EXTENSION: Record<ImageFormat, string> = {
  png: "png",
  jpeg: "jpg",
  webp: "webp",
  gif: "gif",
  svg: "svg",
};

/** 拡張子（小文字、ドットなし）→ 形式。ZIP 内のファイルの絞り込みに使う */
export const EXTENSION_TO_FORMAT: Record<string, ImageFormat> = {
  png: "png",
  jpg: "jpeg",
  jpeg: "jpeg",
  jpe: "jpeg",
  jfif: "jpeg",
  webp: "webp",
  gif: "gif",
  svg: "svg",
};

/** 入力で受け付ける MIME → 形式。マニフェストも同じ集合を使う */
export const MIME_TO_FORMAT: Record<string, ImageFormat> = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/jpg": "jpeg",
  "image/pjpeg": "jpeg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

export function isRasterFormat(format: ImageFormat): format is RasterFormat {
  return format === "png" || format === "jpeg" || format === "webp";
}

export function formatFromExtension(name: string): ImageFormat | null {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return m ? (EXTENSION_TO_FORMAT[m[1]?.toLowerCase() ?? ""] ?? null) : null;
}

export function formatFromMime(type: string | undefined): ImageFormat | null {
  const mime = (type ?? "").toLowerCase().split(";")[0]?.trim() ?? "";
  return Object.hasOwn(MIME_TO_FORMAT, mime) ? (MIME_TO_FORMAT[mime] ?? null) : null;
}

function startsWith(bytes: Uint8Array, sig: number[], offset = 0): boolean {
  if (bytes.length < offset + sig.length) return false;
  return sig.every((b, i) => bytes[offset + i] === b);
}

/** 先頭バイトから形式を判定する。判定できなければ null */
export function detectFormat(input: ArrayBuffer | Uint8Array): ImageFormat | null {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return "gif";
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return "webp";
  }
  if (looksLikeSvg(bytes)) return "svg";
  return null;
}

/** 先頭 2KB をテキストとして見て <svg が現れるか（BOM・XML 宣言・コメント・DOCTYPE を許す） */
function looksLikeSvg(bytes: Uint8Array): boolean {
  const head = new TextDecoder("utf-8", { fatal: false }).decode(bytes.subarray(0, 2048));
  const trimmed = (head.charCodeAt(0) === 0xfeff ? head.slice(1) : head).trimStart();
  if (!trimmed.startsWith("<")) return false;
  return /<svg[\s>/]/i.test(trimmed);
}

/** 判定に失敗したら拡張子・MIME で補う（SVG のテキスト判定が外れた場合など） */
export function detectFormatWithHints(
  input: ArrayBuffer | Uint8Array,
  hints: { name?: string; type?: string } = {},
): ImageFormat | null {
  const detected = detectFormat(input);
  if (detected) return detected;
  // 中身で分からないときは、拡張子か MIME が SVG と言っている場合だけ信用する（他の形式は中身で必ず分かる）
  const byName = hints.name ? formatFromExtension(hints.name) : null;
  const byMime = formatFromMime(hints.type);
  return byName === "svg" || byMime === "svg" ? "svg" : null;
}
