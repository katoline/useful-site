/**
 * 先頭バイト（マジックナンバー）による画像形式の判定。
 * 返す Content-Type は上流の値ではなく、ここで判定した形式から決める。
 */

export type SniffedFormat = "png" | "jpeg" | "gif" | "webp" | "svg";

export const FORMAT_CONTENT_TYPES: Record<SniffedFormat, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};

/** バイナリ形式の判定に要るバイト数（WebP の "RIFF....WEBP" が 12 バイト） */
export const BINARY_SNIFF_BYTES = 16;

/**
 * SVG（テキスト）の判定で読む上限。XML 宣言・コメント・DOCTYPE の後に <svg が来るので、
 * バイナリより長めに見る。これ以上はバッファしない
 */
export const TEXT_SNIFF_BYTES = 1024;

export type SniffResult =
  | { kind: "match"; format: SniffedFormat }
  /** テキストの可能性があり、判定にもっとバイトが要る */
  | { kind: "need_more" }
  | { kind: "no_match" };

function startsWith(bytes: Uint8Array, sig: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + sig.length) return false;
  return sig.every((b, i) => bytes[offset + i] === b);
}

const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff];
const GIF87 = ascii("GIF87a");
const GIF89 = ascii("GIF89a");
const RIFF = ascii("RIFF");
const WEBP = ascii("WEBP");

/**
 * SVG の判定。UTF-8 の BOM と空白を飛ばして `<svg` で始まるか、
 * `<?xml` / `<!--` / `<!DOCTYPE` で始まり、読んだ範囲に `<svg` があるものを SVG とする。
 * （`<?xml` だけでは XHTML 等も通るので、`<svg` の存在まで確かめる）
 */
function sniffSvg(bytes: Uint8Array, done: boolean): SniffResult {
  // 判定を続けられるのは、まだ読み終えておらず、上限に達していないときだけ（どの分岐でも同じ条件）
  const canReadMore = !done && bytes.length < TEXT_SNIFF_BYTES;
  const undecided: SniffResult = canReadMore ? { kind: "need_more" } : { kind: "no_match" };
  let text = new TextDecoder().decode(bytes);
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  text = text.trimStart();
  if (text === "") return undecided;
  const lower = text.toLowerCase();
  if (lower.startsWith("<svg")) {
    // `<svg` の直後は空白・`>`・`/` のいずれか（`<svgfoo` を除く）
    if (lower.length < 5) return undecided;
    return /[\s>/]/.test(lower.charAt(4)) ? { kind: "match", format: "svg" } : { kind: "no_match" };
  }
  const prologue = ["<?xml", "<!--", "<!doctype"];
  const isPrologue = prologue.some((p) => lower.startsWith(p));
  const isPartialPrologue = prologue.some((p) => p.startsWith(lower));
  if (isPrologue) {
    if (/<svg[\s>/]/.test(lower)) return { kind: "match", format: "svg" };
    return undecided;
  }
  if (isPartialPrologue) return undecided;
  return { kind: "no_match" };
}

/**
 * 先頭バイトから形式を判定する。done は上流のボディをすべて読み終えたか。
 * 判定に足りなければ need_more を返すので、呼び出し側は追加で読んでから再度呼ぶ
 */
export function sniffImage(bytes: Uint8Array, done: boolean): SniffResult {
  if (startsWith(bytes, PNG)) return { kind: "match", format: "png" };
  if (startsWith(bytes, JPEG)) return { kind: "match", format: "jpeg" };
  if (startsWith(bytes, GIF87) || startsWith(bytes, GIF89)) return { kind: "match", format: "gif" };
  if (startsWith(bytes, RIFF) && startsWith(bytes, WEBP, 8))
    return { kind: "match", format: "webp" };
  if (bytes.length < BINARY_SNIFF_BYTES && !done) return { kind: "need_more" };
  return sniffSvg(bytes, done);
}
