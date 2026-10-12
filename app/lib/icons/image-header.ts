/**
 * 画像ファイルの先頭バイトから幅・高さを読む（デコードせずにピクセル数の上限を判定するため。plan.md §5）。
 * 対応：PNG（IHDR）・JPEG（SOF）・WebP（VP8 / VP8L / VP8X）・GIF（論理画面）。読めなければ null。
 */
import { readPngSize } from "./ico";

export interface ImageSize {
  width: number;
  height: number;
}

/** ヘッダーを読むのに使う先頭のバイト数（JPEG は EXIF 等の後ろに SOF があるので多めに取る） */
export const IMAGE_HEADER_BYTES = 256 * 1024;

function ascii(bytes: Uint8Array, start: number, length: number): string {
  let s = "";
  for (let i = start; i < start + length && i < bytes.length; i++) {
    s += String.fromCharCode(bytes[i] ?? 0);
  }
  return s;
}

const SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

function readJpegSize(bytes: Uint8Array): ImageSize | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let i = 2;
  while (i + 3 < bytes.length) {
    if (bytes[i] !== 0xff) return null;
    // 埋め草の 0xFF を飛ばす
    while (bytes[i + 1] === 0xff && i + 2 < bytes.length) i++;
    const marker = bytes[i + 1] ?? 0;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      i += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return null; // 画像の終わり・本体の開始より前に SOF が無い
    if (i + 4 > bytes.length) return null;
    const length = view.getUint16(i + 2);
    if (SOF_MARKERS.has(marker)) {
      if (i + 9 > bytes.length) return null;
      const height = view.getUint16(i + 5);
      const width = view.getUint16(i + 7);
      return width > 0 && height > 0 ? { width, height } : null;
    }
    if (length < 2) return null;
    i += 2 + length;
  }
  return null;
}

function readWebpSize(bytes: Uint8Array): ImageSize | null {
  if (ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP" || bytes.length < 30) {
    return null;
  }
  const chunk = ascii(bytes, 12, 4);
  const b = (i: number) => bytes[i] ?? 0;
  if (chunk === "VP8 ") {
    // フレームヘッダー（3 バイト）＋開始コード 9d 01 2a の後ろに幅・高さ（下位 14 ビット）
    if (b(23) !== 0x9d || b(24) !== 0x01 || b(25) !== 0x2a) return null;
    return { width: (b(26) | (b(27) << 8)) & 0x3fff, height: (b(28) | (b(29) << 8)) & 0x3fff };
  }
  if (chunk === "VP8L") {
    if (b(20) !== 0x2f) return null;
    return {
      width: 1 + (b(21) | ((b(22) & 0x3f) << 8)),
      height: 1 + ((b(22) >> 6) | (b(23) << 2) | ((b(24) & 0x0f) << 10)),
    };
  }
  if (chunk === "VP8X") {
    return {
      width: 1 + (b(24) | (b(25) << 8) | (b(26) << 16)),
      height: 1 + (b(27) | (b(28) << 8) | (b(29) << 16)),
    };
  }
  return null;
}

function readGifSize(bytes: Uint8Array): ImageSize | null {
  if (ascii(bytes, 0, 4) !== "GIF8" || bytes.length < 10) return null;
  const width = (bytes[6] ?? 0) | ((bytes[7] ?? 0) << 8);
  const height = (bytes[8] ?? 0) | ((bytes[9] ?? 0) << 8);
  return width > 0 && height > 0 ? { width, height } : null;
}

/** 先頭バイトから幅・高さを読む（形式はバイト列から判定する） */
export function readImageSize(bytes: Uint8Array): ImageSize | null {
  return readPngSize(bytes) ?? readJpegSize(bytes) ?? readWebpSize(bytes) ?? readGifSize(bytes);
}

/** ピクセル数が上限を超えるか */
export function exceedsPixels(size: ImageSize, maxPixels: number): boolean {
  return size.width * size.height > maxPixels;
}
