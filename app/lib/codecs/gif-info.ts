/**
 * GIF の簡易パーサー（フレーム数・サイズ・アニメーション判定）。
 * 依存なしで Node でも動くので、テストと E2E（フレームが保たれているかの確認）にも使う。
 */

export interface GifInfo {
  width: number;
  height: number;
  frames: number;
  animated: boolean;
}

function skipSubBlocks(bytes: Uint8Array, offset: number): number {
  let p = offset;
  while (p < bytes.length) {
    const size = bytes[p] ?? 0;
    p += 1;
    if (size === 0) break;
    p += size;
  }
  return p;
}

export function readGifInfo(input: ArrayBuffer | Uint8Array): GifInfo | null {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length < 13) return null;
  const sig = String.fromCharCode(...bytes.subarray(0, 6));
  if (sig !== "GIF87a" && sig !== "GIF89a") return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint16(6, true);
  const height = view.getUint16(8, true);
  const flags = bytes[10] ?? 0;
  let p = 13;
  // グローバルカラーテーブル
  if (flags & 0x80) p += 3 * 2 ** ((flags & 0x07) + 1);

  let frames = 0;
  while (p < bytes.length) {
    const block = bytes[p];
    if (block === 0x3b) break; // Trailer
    if (block === 0x21) {
      // 拡張ブロック：ラベル 1 バイト＋サブブロック列
      p = skipSubBlocks(bytes, p + 2);
      continue;
    }
    if (block === 0x2c) {
      // 画像記述子 9 バイト（＋ローカルカラーテーブル）＋ LZW 最小コードサイズ＋サブブロック列
      const localFlags = bytes[p + 9] ?? 0;
      p += 10;
      if (localFlags & 0x80) p += 3 * 2 ** ((localFlags & 0x07) + 1);
      p = skipSubBlocks(bytes, p + 1);
      frames++;
      continue;
    }
    // 不明なブロックは壊れているとみなして打ち切る
    break;
  }
  return { width, height, frames, animated: frames > 1 };
}

export function countGifFrames(input: ArrayBuffer | Uint8Array): number {
  return readGifInfo(input)?.frames ?? 0;
}
