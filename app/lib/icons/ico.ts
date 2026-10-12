/**
 * ICO コンテナの組み立て（PNG をそのまま格納する。Windows Vista 以降・全モダンブラウザが対応）。
 *
 * 構成（すべてリトルエンディアン）
 *   ICONDIR（6 バイト）: reserved=0 (u16), type=1 (u16), count (u16)
 *   ICONDIRENTRY × count（16 バイトずつ）:
 *     width (u8, 256 は 0), height (u8, 256 は 0), colorCount=0 (u8), reserved=0 (u8),
 *     planes=1 (u16), bitCount=32 (u16), bytesInRes (u32), imageOffset (u32)
 *   画像データ（PNG のバイト列を順に連結）
 */

export const ICO_HEADER_SIZE = 6;
export const ICO_ENTRY_SIZE = 16;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** PNG の IHDR から幅・高さを読む。PNG でなければ null */
export function readPngSize(png: Uint8Array): { width: number; height: number } | null {
  if (png.length < 24) return null;
  for (let i = 0; i < PNG_SIGNATURE.length; i++) {
    if (png[i] !== PNG_SIGNATURE[i]) return null;
  }
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  // 8: チャンク長, 12: "IHDR", 16: 幅, 20: 高さ（ビッグエンディアン）
  const type = String.fromCharCode(png[12] ?? 0, png[13] ?? 0, png[14] ?? 0, png[15] ?? 0);
  if (type !== "IHDR") return null;
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

/** PNG のバイト列から ICO を作る。サイズは各 PNG の IHDR から読む（1〜256px） */
export function encodeIco(pngs: readonly Uint8Array[]): Uint8Array {
  if (pngs.length === 0) throw new Error("ICO に入れる画像がありません");
  if (pngs.length > 0xffff) throw new Error("ICO に入れられる画像の数を超えています");

  const sizes = pngs.map((png, i) => {
    const size = readPngSize(png);
    if (!size) throw new Error(`${i} 番目の画像が PNG ではありません`);
    if (size.width < 1 || size.width > 256 || size.height < 1 || size.height > 256) {
      throw new Error(`${i} 番目の画像のサイズが ICO の範囲（1〜256px）外です`);
    }
    return size;
  });

  const dataOffset = ICO_HEADER_SIZE + ICO_ENTRY_SIZE * pngs.length;
  const total = dataOffset + pngs.reduce((sum, png) => sum + png.length, 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);

  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true);
  view.setUint16(4, pngs.length, true);

  let offset = dataOffset;
  pngs.forEach((png, i) => {
    const { width, height } = sizes[i] as { width: number; height: number };
    const entry = ICO_HEADER_SIZE + ICO_ENTRY_SIZE * i;
    view.setUint8(entry, width === 256 ? 0 : width);
    view.setUint8(entry + 1, height === 256 ? 0 : height);
    view.setUint8(entry + 2, 0);
    view.setUint8(entry + 3, 0);
    view.setUint16(entry + 4, 1, true);
    view.setUint16(entry + 6, 32, true);
    view.setUint32(entry + 8, png.length, true);
    view.setUint32(entry + 12, offset, true);
    out.set(png, offset);
    offset += png.length;
  });
  return out;
}
