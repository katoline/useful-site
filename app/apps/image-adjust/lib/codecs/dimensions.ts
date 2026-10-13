/**
 * ヘッダーから画像の幅・高さだけを読む（デコード前のピクセル数上限チェック用。§5）。
 * 全体をデコードするとメモリを食うので、先頭の数十〜数百バイトだけ見る。
 */
import type { ImageFormat } from "./format";

export interface Dimensions {
  width: number;
  height: number;
}

export function readDimensions(
  format: ImageFormat,
  input: ArrayBuffer | Uint8Array,
): Dimensions | null {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  switch (format) {
    case "png":
      return readPng(bytes, view);
    case "jpeg":
      return readJpeg(bytes, view);
    case "webp":
      return readWebp(bytes, view);
    case "gif":
      return readGif(bytes, view);
    case "svg":
      return null;
  }
}

function readPng(bytes: Uint8Array, view: DataView): Dimensions | null {
  // IHDR は必ず先頭チャンク：シグネチャ 8 + 長さ 4 + "IHDR" 4 → 幅・高さ各 4 バイト
  if (bytes.length < 24) return null;
  if (String.fromCharCode(...bytes.subarray(12, 16)) !== "IHDR") return null;
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function readJpeg(bytes: Uint8Array, view: DataView): Dimensions | null {
  // SOF マーカー（FFC0〜FFCF、ただし C4・C8・CC を除く）まで読み進める
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = bytes[offset + 1] ?? 0;
    if (marker === 0xff) {
      offset++;
      continue;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const length = view.getUint16(offset + 2);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) };
    }
    if (marker === 0xda) return null; // SOS（画像データ）まで来たら諦める
    offset += 2 + length;
  }
  return null;
}

function readWebp(bytes: Uint8Array, view: DataView): Dimensions | null {
  if (bytes.length < 30) return null;
  const chunk = String.fromCharCode(...bytes.subarray(12, 16));
  if (chunk === "VP8 ") {
    // 非可逆：フレームヘッダーの 6 バイト目から 14 ビットずつ
    return {
      width: view.getUint16(26, true) & 0x3fff,
      height: view.getUint16(28, true) & 0x3fff,
    };
  }
  if (chunk === "VP8L") {
    const b = view.getUint32(21, true);
    return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8X") {
    const w = (bytes[24] ?? 0) | ((bytes[25] ?? 0) << 8) | ((bytes[26] ?? 0) << 16);
    const h = (bytes[27] ?? 0) | ((bytes[28] ?? 0) << 8) | ((bytes[29] ?? 0) << 16);
    return { width: w + 1, height: h + 1 };
  }
  return null;
}

function readGif(bytes: Uint8Array, view: DataView): Dimensions | null {
  if (bytes.length < 10) return null;
  return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
}
