/**
 * 画像ファイルの実デコード・縮小・PNG 再エンコード（DOM と Canvas に依存する）。
 * SVG・GIF や、拡張子を偽った画像は先頭バイトの検査で弾く。Blob URL は必ず解放する。
 */
import { type IconImageErrorReason, MAX_ICON_ARTWORK_DIMENSION } from "../../../domain/icons";
import { fitWithinLimit, isWithinSourceDimensions, sniffIconImageType } from "../core/validate";

/** デコード段階で失敗した理由（type・dimension・decode）。size・文言は core が決める */
export class IconImageError extends Error {
  readonly reason: Exclude<IconImageErrorReason, "size">;

  constructor(reason: Exclude<IconImageErrorReason, "size">) {
    super(`icon image error: ${reason}`);
    this.name = "IconImageError";
    this.reason = reason;
  }
}

/** 読み込みが追い越された・取り消されたとき。呼び出し側は結果を捨てる */
export class IconImageAbortError extends Error {
  constructor() {
    super("icon image load aborted");
    this.name = "IconImageAbortError";
  }
}

export interface DecodedIconImage {
  readonly dataUrl: string;
  readonly width: number;
  readonly height: number;
}

interface DecodeSource {
  readonly source: CanvasImageSource;
  readonly width: number;
  readonly height: number;
  release(): void;
}

const HEADER_BYTES = 16;

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new IconImageAbortError();
}

/** 先頭バイトを読んで、PNG・JPEG・WebP 以外を拒否する */
async function assertSupportedBytes(file: Blob): Promise<void> {
  const header = await file.slice(0, HEADER_BYTES).arrayBuffer();
  if (!sniffIconImageType(new Uint8Array(header))) throw new IconImageError("type");
}

/** createImageBitmap でデコードする（EXIF の向きを反映する） */
async function decodeWithBitmap(file: Blob, signal?: AbortSignal): Promise<DecodeSource> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    if (signal?.aborted) {
      bitmap.close();
      throw new IconImageAbortError();
    }
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      release: () => bitmap.close(),
    };
  } catch (error) {
    // 読み込み中に取り消された場合はそのまま伝える。デコード不能なら <img> を試す
    if (error instanceof IconImageAbortError) throw error;
    return decodeWithElement(file, signal);
  }
}

/** createImageBitmap が無い・使えない環境向け。<img> を使い、Blob URL は必ず解放する */
function decodeWithElement(file: Blob, signal?: AbortSignal): Promise<DecodeSource> {
  return new Promise<DecodeSource>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    const release = () => {
      image.onload = null;
      image.onerror = null;
      signal?.removeEventListener("abort", onAbort);
      URL.revokeObjectURL(url);
    };
    const onAbort = () => {
      release();
      reject(new IconImageAbortError());
    };
    image.onload = () => {
      release();
      if (signal?.aborted) {
        reject(new IconImageAbortError());
        return;
      }
      resolve({
        source: image,
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
        release: () => {},
      });
    };
    image.onerror = () => {
      release();
      reject(new IconImageError("decode"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    image.src = url;
  });
}

async function decode(file: Blob, signal?: AbortSignal): Promise<DecodeSource> {
  throwIfAborted(signal);
  if (typeof createImageBitmap === "function") return decodeWithBitmap(file, signal);
  return decodeWithElement(file, signal);
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");
  if (!context) throw new IconImageError("decode");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  return context;
}

/** 段階的に半分へ縮小してから目的の大きさへ描く（1 回で大きく縮小すると粗くなるため） */
function drawToPng(
  sourceImage: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): string {
  let canvas = createCanvas(sourceWidth, sourceHeight);
  context2d(canvas).drawImage(sourceImage, 0, 0, sourceWidth, sourceHeight);
  let width = sourceWidth;
  let height = sourceHeight;

  while (width > targetWidth * 2 && height > targetHeight * 2) {
    const nextWidth = Math.max(targetWidth, Math.floor(width / 2));
    const nextHeight = Math.max(targetHeight, Math.floor(height / 2));
    const next = createCanvas(nextWidth, nextHeight);
    context2d(next).drawImage(canvas, 0, 0, width, height, 0, 0, nextWidth, nextHeight);
    canvas = next;
    width = nextWidth;
    height = nextHeight;
  }

  const output = createCanvas(targetWidth, targetHeight);
  context2d(output).drawImage(canvas, 0, 0, width, height, 0, 0, targetWidth, targetHeight);
  return output.toDataURL("image/png");
}

/**
 * 画像を実際にデコードして上限を確かめ、最大 512px へ縮小して PNG の data URL にする。
 * signal が取り消されたら IconImageAbortError を投げる（呼び出し側は結果を捨てる）。
 */
export async function decodeIconImage(file: Blob, signal?: AbortSignal): Promise<DecodedIconImage> {
  await assertSupportedBytes(file);
  throwIfAborted(signal);
  const decoded = await decode(file, signal);
  try {
    throwIfAborted(signal);
    if (!isWithinSourceDimensions(decoded.width, decoded.height))
      throw new IconImageError("dimension");
    const target = fitWithinLimit(decoded.width, decoded.height, MAX_ICON_ARTWORK_DIMENSION);
    const dataUrl = drawToPng(
      decoded.source,
      decoded.width,
      decoded.height,
      target.width,
      target.height,
    );
    return { dataUrl, width: target.width, height: target.height };
  } finally {
    decoded.release();
  }
}
