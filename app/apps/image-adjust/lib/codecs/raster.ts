/**
 * PNG / JPEG / WebP のデコード・エンコード・リサイズ（jSquash の薄いラッパー）。
 * コーデック（WASM）は最初に使うときに動的 import する（初回表示に含めない。§3.7）。
 * Web Worker・メインスレッド・Node（テスト）のどこでも動く純粋な関数だけを置く。
 */
import type { RasterFormat } from "./format";
import { quantizeToPng } from "./quantize";

/** ImageData 互換（Node のテストでは ImageData が無いので構造だけ合わせる） */
export interface RasterImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface JpegEncodeOptions {
  /** 0〜100 */
  quality: number;
  progressive?: boolean;
}

export interface WebpEncodeOptions {
  /** 0〜100（lossless のときは無視） */
  quality: number;
  lossless?: boolean;
}

export interface PngEncodeOptions {
  /** 減色後の色数（2〜256）。null なら可逆のまま */
  colors?: number | null;
  /** OxiPNG の最適化レベル（0〜6）。大きいほど遅い */
  level?: number;
}

export type RasterEncodeOptions =
  | ({ format: "jpeg" } & JpegEncodeOptions)
  | ({ format: "webp" } & WebpEncodeOptions)
  | ({ format: "png" } & PngEncodeOptions);

function clampQuality(q: number): number {
  return Math.min(100, Math.max(0, Math.round(q)));
}

export async function decodeRaster(format: RasterFormat, buffer: ArrayBuffer): Promise<ImageData> {
  switch (format) {
    case "png": {
      const { decode } = await import("@jsquash/png");
      return decode(buffer);
    }
    case "jpeg": {
      const { decode } = await import("@jsquash/jpeg");
      // EXIF の向き（Orientation）をピクセルに反映して受け取る（メタデータは再エンコードで落ちるため）。
      // jSquash の preserveOrientation: true は「向きの情報どおりに回転する」の意味
      return decode(buffer, { preserveOrientation: true });
    }
    case "webp": {
      const { decode } = await import("@jsquash/webp");
      return decode(buffer);
    }
  }
}

export async function encodeJpeg(image: RasterImage, o: JpegEncodeOptions): Promise<ArrayBuffer> {
  const { encode } = await import("@jsquash/jpeg");
  return encode(image as ImageData, {
    quality: clampQuality(o.quality),
    progressive: o.progressive ?? true,
    optimize_coding: true,
  });
}

export async function encodeWebp(image: RasterImage, o: WebpEncodeOptions): Promise<ArrayBuffer> {
  const { encode } = await import("@jsquash/webp");
  if (o.lossless) {
    return encode(image as ImageData, { lossless: 1, quality: 100, exact: 0 });
  }
  return encode(image as ImageData, { quality: clampQuality(o.quality) });
}

export async function encodePng(
  image: RasterImage,
  o: PngEncodeOptions = {},
): Promise<ArrayBuffer> {
  const { optimise } = await import("@jsquash/oxipng");
  const level = o.level ?? 2;
  if (o.colors != null && o.colors < 256) {
    // 減色（非可逆）→ OxiPNG で可逆に詰める
    const indexed = await quantizeToPng(image, Math.max(2, Math.round(o.colors)));
    return optimise(indexed, { level, optimiseAlpha: true });
  }
  // 可逆：RGBA から直接 OxiPNG でエンコードする
  return optimise(image as ImageData, { level, optimiseAlpha: false });
}

export async function encodeRaster(
  image: RasterImage,
  o: RasterEncodeOptions,
): Promise<ArrayBuffer> {
  switch (o.format) {
    case "jpeg":
      return encodeJpeg(image, o);
    case "webp":
      return encodeWebp(image, o);
    case "png":
      return encodePng(image, o);
  }
}

/** Lanczos3 でリサイズする */
export async function resizeImage(
  image: RasterImage,
  width: number,
  height: number,
): Promise<ImageData> {
  if (width === image.width && height === image.height) return image as ImageData;
  const { default: resize } = await import("@jsquash/resize");
  return resize(image as ImageData, {
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
    method: "lanczos3",
    premultiply: true,
    linearRGB: false,
  });
}

/** 完全に不透明でないピクセルがあるか */
export function hasTransparency(image: RasterImage): boolean {
  const d = image.data;
  for (let i = 3; i < d.length; i += 4) {
    if ((d[i] ?? 255) !== 255) return true;
  }
  return false;
}

/** "#rrggbb" / "#rgb" → [r, g, b]。読めなければ白 */
export function parseHexColor(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m?.[1]) return [255, 255, 255];
  let h = m[1];
  if (h.length === 3) h = h.replace(/./g, (c) => c + c);
  return [
    Number.parseInt(h.slice(0, 2), 16),
    Number.parseInt(h.slice(2, 4), 16),
    Number.parseInt(h.slice(4, 6), 16),
  ];
}

/** 透過を背景色で塗りつぶす（JPEG 出力用。§2.1）。元の配列は変えない */
export function flattenOnColor(image: RasterImage, hex: string): RasterImage {
  const [br, bg, bb] = parseHexColor(hex);
  const src = image.data;
  const out = new Uint8ClampedArray(src.length);
  for (let i = 0; i < src.length; i += 4) {
    const a = (src[i + 3] ?? 255) / 255;
    out[i] = Math.round((src[i] ?? 0) * a + br * (1 - a));
    out[i + 1] = Math.round((src[i + 1] ?? 0) * a + bg * (1 - a));
    out[i + 2] = Math.round((src[i + 2] ?? 0) * a + bb * (1 - a));
    out[i + 3] = 255;
  }
  return { data: out, width: image.width, height: image.height };
}
