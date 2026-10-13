/**
 * プレビュー用 Blob の作り方（§3.6 とセキュリティレビューの指摘）。
 *
 * SVG の blob: URL を <img src> や <a href> に出してはいけない。blob: URL はこのページのオリジンを
 * 受け継ぐので、利用者が「画像を新しいタブで開く」を選ぶと SVG 内の <script> がこのオリジンで
 * 実行される（SVGO の既定設定では script は消えない）。
 * そのため SVG は canvas でラスタライズした PNG を使い、SVG の blob: URL は canvas に描く間だけ
 * 作ってすぐ revoke する。保存するファイルの中身は SVG のままでよい。
 *
 * 結果カードのサムネイルは縮小した PNG にして、元画像をフルサイズでデコードしたまま持たない。
 */
import { readDimensions } from "~/apps/image-adjust/lib/codecs/dimensions";
import type { ImageFormat } from "~/apps/image-adjust/lib/codecs/format";

/** プレビューに元の blob を直接使えない（ラスタライズが要る）形式か */
export function needsRasterPreview(format: ImageFormat | null, mimeType?: string): boolean {
  return format === "svg" || (mimeType ?? "").toLowerCase().startsWith("image/svg");
}

/** 比較表示（フルサイズ寄り）の最長辺。表示は CSS で縮める */
export const PREVIEW_MAX_EDGE = 2048;
/** 結果カードのサムネイルの最長辺 */
export const THUMBNAIL_MAX_EDGE = 200;

function fitWithin(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(width, height, 1));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

/**
 * SVG を PNG にラスタライズする。blob: URL は <img> の読み込みに使った直後に revoke する。
 * 失敗したら null（呼び出し側はプレースホルダーを出す）。
 */
export async function rasterizeSvg(svg: Blob, maxEdge = PREVIEW_MAX_EDGE): Promise<Blob | null> {
  if (typeof document === "undefined") return null;
  const url = URL.createObjectURL(svg);
  try {
    const img = await loadImage(url);
    const size = fitWithin(img.naturalWidth || 512, img.naturalHeight || 512, maxEdge);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await canvasToBlob(canvas);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = url;
  });
}

/** ヘッダーから元のサイズを読む（先頭だけ読む） */
async function readBlobDimensions(blob: Blob, format: ImageFormat) {
  const head = new Uint8Array(await blob.slice(0, 64 * 1024).arrayBuffer());
  return readDimensions(format, head);
}

/**
 * ラスタ画像を maxEdge に収めた PNG にする（createImageBitmap の縮小）。
 * 縮小が要らない・できない環境では null（呼び出し側は元の blob を使う）。
 */
async function shrinkRaster(
  blob: Blob,
  format: ImageFormat,
  maxEdge: number,
): Promise<Blob | null> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return null;
  const dims = await readBlobDimensions(blob, format);
  if (!dims || Math.max(dims.width, dims.height) <= maxEdge) return null;
  const size = fitWithin(dims.width, dims.height, maxEdge);
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(blob, {
      resizeWidth: size.width,
      resizeHeight: size.height,
      resizeQuality: "medium",
    });
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0);
    return await canvasToBlob(canvas);
  } catch {
    return null;
  } finally {
    bitmap?.close();
  }
}

/**
 * 画面に出してよい blob を返す。SVG はラスタライズした PNG、それ以外は元の blob
 * （maxEdge を渡すと、それに収めた縮小版）。ラスタライズに失敗したら null。
 */
export async function toPreviewBlob(
  blob: Blob,
  format: ImageFormat | null,
  maxEdge?: number,
): Promise<Blob | null> {
  if (needsRasterPreview(format, blob.type)) return rasterizeSvg(blob, maxEdge);
  if (maxEdge && format) return (await shrinkRaster(blob, format, maxEdge)) ?? blob;
  return blob;
}
