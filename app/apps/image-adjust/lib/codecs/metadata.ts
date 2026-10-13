/**
 * メタデータの除去と ICC プロファイルの付け替え（§2.5）。
 * - stripMetadata：EXIF / XMP / IPTC / テキスト等を元のバイト列から取り除く（ICC は色のために残す）。
 *   再エンコードしない経路（元のまま返す・アニメーション WebP）で使う
 * - extractIcc / embedIcc：入力の ICC を出力の形式に合わせて埋め込み直す（再エンコードで落ちるため）
 * 依存は fflate（PNG の iCCP の zlib）だけ。Worker・Node のどちらでも動く。
 */
import { unzlibSync, zlibSync } from "fflate";
import { readDimensions } from "./dimensions";
import type { ImageFormat, RasterFormat } from "./format";

const ICC_PROFILE_SIG = "ICC_PROFILE\0";
const NETSCAPE = "NETSCAPE2.0";

function bytesOf(input: ArrayBuffer | Uint8Array): Uint8Array {
  return input instanceof Uint8Array ? input : new Uint8Array(input);
}

function toArrayBuffer(parts: Uint8Array[]): ArrayBuffer {
  const size = parts.reduce((s, p) => s + p.byteLength, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.byteLength;
  }
  return out.buffer as ArrayBuffer;
}

function ascii(s: string): Uint8Array {
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

function asciiAt(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

// ---------------------------------------------------------------- JPEG

interface JpegSegment {
  marker: number;
  /** マーカーを含む開始位置 */
  start: number;
  /** セグメント全体の長さ（マーカー 2 ＋長さフィールド込み） */
  length: number;
}

/** SOI 以降のセグメントを SOS の手前まで列挙する。残り（SOS 以降）は restOffset から */
function jpegSegments(bytes: Uint8Array): { segments: JpegSegment[]; restOffset: number } {
  const segments: JpegSegment[] = [];
  let p = 2;
  while (p + 4 <= bytes.length) {
    if (bytes[p] !== 0xff) break;
    const marker = bytes[p + 1] ?? 0;
    if (marker === 0xda || marker === 0xd9) break; // SOS / EOI
    if (marker === 0xff) {
      p++;
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      segments.push({ marker, start: p, length: 2 });
      p += 2;
      continue;
    }
    const len = ((bytes[p + 2] ?? 0) << 8) | (bytes[p + 3] ?? 0);
    segments.push({ marker, start: p, length: 2 + len });
    p += 2 + len;
  }
  return { segments, restOffset: p };
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes[0] === 0xff && bytes[1] === 0xd8;
}

/** APP1（EXIF / XMP）・APP13（IPTC）・COM を取り除く。APP2（ICC）は残す */
function stripJpeg(bytes: Uint8Array): ArrayBuffer {
  if (!isJpeg(bytes)) return bytes.slice().buffer as ArrayBuffer;
  const { segments, restOffset } = jpegSegments(bytes);
  const parts: Uint8Array[] = [bytes.subarray(0, 2)];
  for (const s of segments) {
    if (s.marker === 0xe1 || s.marker === 0xed || s.marker === 0xfe) continue;
    parts.push(bytes.subarray(s.start, s.start + s.length));
  }
  parts.push(bytes.subarray(restOffset));
  return toArrayBuffer(parts);
}

function extractIccJpeg(bytes: Uint8Array): Uint8Array | null {
  if (!isJpeg(bytes)) return null;
  const { segments } = jpegSegments(bytes);
  const chunks: { seq: number; data: Uint8Array }[] = [];
  for (const s of segments) {
    if (s.marker !== 0xe2 || s.length < 4 + 14) continue;
    const dataStart = s.start + 4;
    if (asciiAt(bytes, dataStart, 12) !== ICC_PROFILE_SIG) continue;
    chunks.push({
      seq: bytes[dataStart + 12] ?? 0,
      data: bytes.subarray(dataStart + 14, s.start + s.length),
    });
  }
  if (chunks.length === 0) return null;
  chunks.sort((a, b) => a.seq - b.seq);
  return new Uint8Array(toArrayBuffer(chunks.map((c) => c.data)));
}

/** APP2 を SOI（と APP0 / APP1 があればその後ろ）に差し込む。既存の ICC は置き換える */
function embedIccJpeg(bytes: Uint8Array, icc: Uint8Array): ArrayBuffer {
  if (!isJpeg(bytes)) return bytes.slice().buffer as ArrayBuffer;
  const { segments, restOffset } = jpegSegments(bytes);
  const MAX = 65533 - 14;
  const count = Math.max(1, Math.ceil(icc.byteLength / MAX));
  const iccSegments: Uint8Array[] = [];
  for (let i = 0; i < count; i++) {
    const data = icc.subarray(i * MAX, (i + 1) * MAX);
    const len = 2 + 14 + data.byteLength;
    const seg = new Uint8Array(2 + len);
    seg[0] = 0xff;
    seg[1] = 0xe2;
    seg[2] = (len >> 8) & 0xff;
    seg[3] = len & 0xff;
    seg.set(ascii(ICC_PROFILE_SIG), 4);
    seg[16] = i + 1;
    seg[17] = count;
    seg.set(data, 18);
    iccSegments.push(seg);
  }
  const parts: Uint8Array[] = [bytes.subarray(0, 2)];
  let inserted = false;
  const insert = () => {
    if (inserted) return;
    parts.push(...iccSegments);
    inserted = true;
  };
  for (const s of segments) {
    const isIcc =
      s.marker === 0xe2 && s.length >= 18 && asciiAt(bytes, s.start + 4, 12) === ICC_PROFILE_SIG;
    if (isIcc) continue;
    // APP0 / APP1 の後ろに置く（JFIF → EXIF → ICC の順が慣例）
    if (!inserted && s.marker !== 0xe0 && s.marker !== 0xe1) insert();
    parts.push(bytes.subarray(s.start, s.start + s.length));
  }
  insert();
  parts.push(bytes.subarray(restOffset));
  return toArrayBuffer(parts);
}

// ---------------------------------------------------------------- PNG

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

interface PngChunk {
  type: string;
  start: number;
  length: number;
  dataStart: number;
  dataLength: number;
}

function isPng(bytes: Uint8Array): boolean {
  return PNG_SIG.every((b, i) => bytes[i] === b);
}

function pngChunks(bytes: Uint8Array): PngChunk[] {
  const chunks: PngChunk[] = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let p = 8;
  while (p + 12 <= bytes.length) {
    const dataLength = view.getUint32(p);
    const type = asciiAt(bytes, p + 4, 4);
    const length = 12 + dataLength;
    if (p + length > bytes.length) break;
    chunks.push({ type, start: p, length, dataStart: p + 8, dataLength });
    p += length;
    if (type === "IEND") break;
  }
  return chunks;
}

let crcTable: Uint32Array | null = null;
function crc32(parts: Uint8Array[]): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const part of parts) {
    for (const b of part) crc = (crcTable[(crc ^ b) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.byteLength);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.byteLength);
  const typeBytes = ascii(type);
  out.set(typeBytes, 4);
  out.set(data, 8);
  view.setUint32(8 + data.byteLength, crc32([typeBytes, data]));
  return out;
}

const PNG_STRIP = new Set(["eXIf", "tEXt", "iTXt", "zTXt"]);

function stripPng(bytes: Uint8Array): ArrayBuffer {
  if (!isPng(bytes)) return bytes.slice().buffer as ArrayBuffer;
  const parts: Uint8Array[] = [bytes.subarray(0, 8)];
  for (const c of pngChunks(bytes)) {
    if (PNG_STRIP.has(c.type)) continue;
    parts.push(bytes.subarray(c.start, c.start + c.length));
  }
  return toArrayBuffer(parts);
}

function extractIccPng(bytes: Uint8Array): Uint8Array | null {
  if (!isPng(bytes)) return null;
  const iccp = pngChunks(bytes).find((c) => c.type === "iCCP");
  if (!iccp) return null;
  const data = bytes.subarray(iccp.dataStart, iccp.dataStart + iccp.dataLength);
  const nul = data.indexOf(0);
  if (nul < 0 || data[nul + 1] !== 0) return null; // 圧縮方式 0（zlib）だけ
  try {
    return unzlibSync(data.subarray(nul + 2));
  } catch {
    return null;
  }
}

function embedIccPng(bytes: Uint8Array, icc: Uint8Array): ArrayBuffer {
  if (!isPng(bytes)) return bytes.slice().buffer as ArrayBuffer;
  const compressed = zlibSync(icc, { level: 6 });
  const name = ascii("ICC profile\0\0");
  const data = new Uint8Array(name.byteLength + compressed.byteLength);
  data.set(name, 0);
  data.set(compressed, name.byteLength);
  const chunk = pngChunk("iCCP", data);
  const parts: Uint8Array[] = [bytes.subarray(0, 8)];
  for (const c of pngChunks(bytes)) {
    if (c.type === "iCCP" || c.type === "sRGB") continue; // sRGB と iCCP は同居できない
    parts.push(bytes.subarray(c.start, c.start + c.length));
    if (c.type === "IHDR") parts.push(chunk);
  }
  return toArrayBuffer(parts);
}

// ---------------------------------------------------------------- WebP

interface RiffChunk {
  fourcc: string;
  start: number;
  /** パディング込みの長さ（ヘッダー 8 ＋データ＋偶数詰め） */
  length: number;
  dataStart: number;
  dataLength: number;
}

function isWebp(bytes: Uint8Array): boolean {
  return asciiAt(bytes, 0, 4) === "RIFF" && asciiAt(bytes, 8, 4) === "WEBP";
}

function webpChunks(bytes: Uint8Array): RiffChunk[] {
  const chunks: RiffChunk[] = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let p = 12;
  while (p + 8 <= bytes.length) {
    const fourcc = asciiAt(bytes, p, 4);
    const dataLength = view.getUint32(p + 4, true);
    const length = 8 + dataLength + (dataLength & 1);
    if (p + 8 + dataLength > bytes.length) break;
    chunks.push({ fourcc, start: p, length, dataStart: p + 8, dataLength });
    p += length;
  }
  return chunks;
}

function riffChunk(fourcc: string, data: Uint8Array): Uint8Array {
  const padded = data.byteLength + (data.byteLength & 1);
  const out = new Uint8Array(8 + padded);
  out.set(ascii(fourcc), 0);
  new DataView(out.buffer).setUint32(4, data.byteLength, true);
  out.set(data, 8);
  return out;
}

function buildWebp(chunks: Uint8Array[]): ArrayBuffer {
  const body = chunks.reduce((s, c) => s + c.byteLength, 0);
  const header = new Uint8Array(12);
  header.set(ascii("RIFF"), 0);
  new DataView(header.buffer).setUint32(4, 4 + body, true);
  header.set(ascii("WEBP"), 8);
  return toArrayBuffer([header, ...chunks]);
}

const VP8X_ICC = 0x20;
const VP8X_ALPHA = 0x10;
const VP8X_EXIF = 0x08;
const VP8X_XMP = 0x04;
const VP8X_ANIM = 0x02;

export function isAnimatedWebp(input: ArrayBuffer | Uint8Array): boolean {
  const bytes = bytesOf(input);
  if (!isWebp(bytes)) return false;
  const first = webpChunks(bytes)[0];
  if (first?.fourcc !== "VP8X") return false;
  return ((bytes[first.dataStart] ?? 0) & VP8X_ANIM) !== 0;
}

function stripWebp(bytes: Uint8Array): ArrayBuffer {
  if (!isWebp(bytes)) return bytes.slice().buffer as ArrayBuffer;
  const out: Uint8Array[] = [];
  for (const c of webpChunks(bytes)) {
    if (c.fourcc === "EXIF" || c.fourcc === "XMP ") continue;
    const chunk = bytes.slice(c.start, c.start + c.length);
    if (c.fourcc === "VP8X") chunk[8] = (chunk[8] ?? 0) & ~(VP8X_EXIF | VP8X_XMP);
    out.push(chunk);
  }
  return buildWebp(out);
}

function extractIccWebp(bytes: Uint8Array): Uint8Array | null {
  if (!isWebp(bytes)) return null;
  const iccp = webpChunks(bytes).find((c) => c.fourcc === "ICCP");
  return iccp ? bytes.slice(iccp.dataStart, iccp.dataStart + iccp.dataLength) : null;
}

/** VP8X コンテナにして ICCP を VP8X の直後に置く（単純な VP8 / VP8L は VP8X に包み直す） */
function embedIccWebp(bytes: Uint8Array, icc: Uint8Array): ArrayBuffer {
  if (!isWebp(bytes)) return bytes.slice().buffer as ArrayBuffer;
  const chunks = webpChunks(bytes).filter((c) => c.fourcc !== "ICCP");
  const first = chunks[0];
  if (!first) return bytes.slice().buffer as ArrayBuffer;
  const iccChunk = riffChunk("ICCP", icc);
  const out: Uint8Array[] = [];
  if (first.fourcc === "VP8X") {
    const vp8x = bytes.slice(first.start, first.start + first.length);
    vp8x[8] = (vp8x[8] ?? 0) | VP8X_ICC;
    out.push(vp8x, iccChunk);
    for (const c of chunks.slice(1)) out.push(bytes.subarray(c.start, c.start + c.length));
    return buildWebp(out);
  }
  const dims = readDimensions("webp", bytes) ?? { width: 1, height: 1 };
  let flags = VP8X_ICC;
  if (first.fourcc === "VP8L") {
    // VP8L ヘッダー：署名 1 バイト＋ 14 ビット幅・14 ビット高さ・1 ビット alpha_is_used
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const header = view.getUint32(first.dataStart + 1, true);
    if ((header >>> 28) & 1) flags |= VP8X_ALPHA;
  }
  if (chunks.some((c) => c.fourcc === "ALPH")) flags |= VP8X_ALPHA;
  const vp8xData = new Uint8Array(10);
  vp8xData[0] = flags;
  const w = dims.width - 1;
  const h = dims.height - 1;
  vp8xData[4] = w & 0xff;
  vp8xData[5] = (w >> 8) & 0xff;
  vp8xData[6] = (w >> 16) & 0xff;
  vp8xData[7] = h & 0xff;
  vp8xData[8] = (h >> 8) & 0xff;
  vp8xData[9] = (h >> 16) & 0xff;
  out.push(riffChunk("VP8X", vp8xData), iccChunk);
  for (const c of chunks) out.push(bytes.subarray(c.start, c.start + c.length));
  return buildWebp(out);
}

// ---------------------------------------------------------------- GIF

function gifSkipSubBlocks(bytes: Uint8Array, offset: number): number {
  let p = offset;
  while (p < bytes.length) {
    const size = bytes[p] ?? 0;
    p += 1;
    if (size === 0) break;
    p += size;
  }
  return p;
}

/** コメント拡張と、NETSCAPE 以外のアプリケーション拡張を取り除く */
function stripGif(bytes: Uint8Array): ArrayBuffer {
  if (asciiAt(bytes, 0, 3) !== "GIF" || bytes.length < 13) {
    return bytes.slice().buffer as ArrayBuffer;
  }
  const flags = bytes[10] ?? 0;
  let p = 13;
  if (flags & 0x80) p += 3 * 2 ** ((flags & 0x07) + 1);
  const parts: Uint8Array[] = [bytes.subarray(0, p)];
  while (p < bytes.length) {
    const block = bytes[p];
    if (block === 0x3b) {
      parts.push(bytes.subarray(p));
      break;
    }
    if (block === 0x21) {
      const label = bytes[p + 1] ?? 0;
      const end = gifSkipSubBlocks(bytes, p + 2);
      const isNetscape =
        label === 0xff && bytes[p + 2] === 11 && asciiAt(bytes, p + 3, 11) === NETSCAPE;
      if (label !== 0xfe && (label !== 0xff || isNetscape)) parts.push(bytes.subarray(p, end));
      p = end;
      continue;
    }
    if (block === 0x2c) {
      const localFlags = bytes[p + 9] ?? 0;
      let q = p + 10;
      if (localFlags & 0x80) q += 3 * 2 ** ((localFlags & 0x07) + 1);
      const end = gifSkipSubBlocks(bytes, q + 1);
      parts.push(bytes.subarray(p, end));
      p = end;
      continue;
    }
    // 壊れている：残りはそのまま
    parts.push(bytes.subarray(p));
    break;
  }
  return toArrayBuffer(parts);
}

// ---------------------------------------------------------------- SVG

function stripSvg(bytes: Uint8Array): ArrayBuffer {
  const text = new TextDecoder("utf-8").decode(bytes);
  const stripped = text
    .replace(/<metadata\b[^>]*\/>/gi, "")
    .replace(/<metadata\b[^>]*>[\s\S]*?<\/metadata\s*>/gi, "");
  const out = new TextEncoder().encode(stripped);
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
}

// ---------------------------------------------------------------- 公開 API

/** EXIF / XMP / IPTC / コメント / テキスト等を取り除く（ICC は残す）。常に新しいバッファを返す */
export function stripMetadata(format: ImageFormat, input: ArrayBuffer | Uint8Array): ArrayBuffer {
  const bytes = bytesOf(input);
  switch (format) {
    case "jpeg":
      return stripJpeg(bytes);
    case "png":
      return stripPng(bytes);
    case "webp":
      return stripWebp(bytes);
    case "gif":
      return stripGif(bytes);
    case "svg":
      return stripSvg(bytes);
  }
}

export function extractIcc(
  format: RasterFormat,
  input: ArrayBuffer | Uint8Array,
): Uint8Array | null {
  const bytes = bytesOf(input);
  switch (format) {
    case "jpeg":
      return extractIccJpeg(bytes);
    case "png":
      return extractIccPng(bytes);
    case "webp":
      return extractIccWebp(bytes);
  }
}

/** ICC を出力形式の作法で埋め込む（既存の ICC は置き換える） */
export function embedIcc(
  format: RasterFormat,
  input: ArrayBuffer | Uint8Array,
  icc: Uint8Array,
): ArrayBuffer {
  const bytes = bytesOf(input);
  switch (format) {
    case "jpeg":
      return embedIccJpeg(bytes, icc);
    case "png":
      return embedIccPng(bytes, icc);
    case "webp":
      return embedIccWebp(bytes, icc);
  }
}

/** JPEG の APP1（EXIF）があるか（テスト・確認用） */
export function hasExif(format: RasterFormat, input: ArrayBuffer | Uint8Array): boolean {
  const bytes = bytesOf(input);
  switch (format) {
    case "jpeg":
      return jpegSegments(bytes).segments.some(
        (s) => s.marker === 0xe1 && asciiAt(bytes, s.start + 4, 4) === "Exif",
      );
    case "png":
      return pngChunks(bytes).some((c) => c.type === "eXIf");
    case "webp":
      return webpChunks(bytes).some((c) => c.fourcc === "EXIF");
  }
}
