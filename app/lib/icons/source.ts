/**
 * 元画像の読み込み（ブラウザ専用）。
 * SVG も <img> 経由で読む（DOM へ直接挿入しない。<img> の SVG ではスクリプトも外部読み込みも動かない §3.6）。
 *
 * 元画像の Blob URL は読み込みの間だけ作り、終わったらすぐ revoke する。画面にも出さない。
 * blob: URL は作ったページのオリジンを受け継ぐので、SVG の blob: URL が「画像を新しいタブで開く」等で
 * トップレベルの文書として開かれると、SVG 内の <script> がこのサイトのオリジンで動いてしまうため。
 * 元画像は読み込み時に作業用 canvas へ縮め（SVG はラスタライズし）、以降はその canvas だけを使う（プレビューは生成した PNG）。
 */
import { type Limits, limitsFor } from "~/lib/limits";
import { exceedsPixels, IMAGE_HEADER_BYTES, readImageSize } from "./image-header";
import { isSvgFile, svgIntrinsicSize, withIntrinsicSize } from "./svg";

export interface IconSource {
  /**
   * 描画に使う画像。ラスター画像も SVG も、読み込み時に長辺 WORKING_SIZE 以下の canvas に 1 回だけ縮めて持つ
   * （元の大きな画像を生成のたびに縮め直すとメモリを使い切るため）。DOM には出さない
   */
  image: HTMLCanvasElement;
  /** image（canvas）の大きさ */
  width: number;
  height: number;
  /** 元画像の大きさ（表示用。SVG は width/height/viewBox から） */
  originalWidth: number;
  originalHeight: number;
  isSvg: boolean;
  /** SVG の中身（favicon.svg に使う） */
  svgText?: string;
  fileName: string;
}

export type IconSourceErrorCode = "unsupported" | "tooLarge" | "decode";

export class IconSourceError extends Error {
  constructor(readonly code: IconSourceErrorCode) {
    super(code);
  }
}

const RASTER_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"]);

/** SVG で大きさが分からないときの縦横比の元（正方形） */
const SVG_FALLBACK_SIZE = 512;

/** 作業用 canvas の長辺（出力の最大は 512px の正方形アイコン。縮小の余裕を見て 2 倍） */
export const WORKING_SIZE = 1024;

/**
 * 作業用 canvas の大きさ。長辺を WORKING_SIZE に収める。
 * ラスター画像は拡大しない（小さい画像はそのまま）。ベクターは長辺をちょうど WORKING_SIZE にする
 */
export function workingSize(
  width: number,
  height: number,
  vector: boolean,
  max = WORKING_SIZE,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  const scale = vector || longest > max ? max / longest : 1;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** 作業用 canvas に描く（大きく縮めるときは半分ずつ縮めて画質を保つ） */
function toWorkingCanvas(
  image: HTMLImageElement,
  size: { width: number; height: number },
): HTMLCanvasElement {
  const makeCanvas = (w: number, h: number) => {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new IconSourceError("decode");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    return { canvas, ctx };
  };
  let current: CanvasImageSource = image;
  let w = image.naturalWidth || size.width;
  let h = image.naturalHeight || size.height;
  // 中間の canvas は 1 枚前のものだけ持つ（前のものは幅 0 にして解放する）
  let previous: HTMLCanvasElement | null = null;
  while (w / 2 >= size.width && h / 2 >= size.height) {
    w = Math.round(w / 2);
    h = Math.round(h / 2);
    const step = makeCanvas(w, h);
    step.ctx.drawImage(current, 0, 0, w, h);
    if (previous) previous.width = 0;
    previous = step.canvas;
    current = step.canvas;
  }
  const out = makeCanvas(size.width, size.height);
  out.ctx.drawImage(current, 0, 0, size.width, size.height);
  if (previous) previous.width = 0;
  return out.canvas;
}

function loadImage(
  url: string,
  maxPixels: number,
  checkPixels: boolean,
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      // 全体を展開（decode）する前に、寸法だけで上限を判定する
      if (
        checkPixels &&
        exceedsPixels({ width: img.naturalWidth, height: img.naturalHeight }, maxPixels)
      ) {
        img.src = "";
        reject(new IconSourceError("tooLarge"));
        return;
      }
      resolve(img);
    };
    img.onerror = () => reject(new IconSourceError("decode"));
    img.src = url;
  });
}

export async function loadIconSource(
  file: File,
  limits: Limits = limitsFor(),
): Promise<IconSource> {
  // 上限は端末に応じた共通の値（plan.md §5、app/lib/limits.ts）
  if (file.size > limits.maxFileBytes) throw new IconSourceError("tooLarge");
  const svg = isSvgFile(file);
  if (!svg && !RASTER_TYPES.has(file.type)) throw new IconSourceError("unsupported");

  let blob: Blob = file;
  let svgText: string | undefined;
  let svgSize: { width: number; height: number } | undefined;
  if (svg) {
    svgText = await file.text();
    svgSize = svgIntrinsicSize(svgText) ?? { width: SVG_FALLBACK_SIZE, height: SVG_FALLBACK_SIZE };
    // 拡張子だけで type が空のこともあるので型を付け直す。描画用には width / height を補う
    blob = new Blob([withIntrinsicSize(svgText, svgSize)], { type: "image/svg+xml" });
  } else {
    // <img> を作る前に、ファイルの先頭（ヘッダー）から寸法を読んで弾く
    const head = new Uint8Array(await file.slice(0, IMAGE_HEADER_BYTES).arrayBuffer());
    const size = readImageSize(head);
    if (size && exceedsPixels(size, limits.maxPixels)) throw new IconSourceError("tooLarge");
  }

  const url = URL.createObjectURL(blob);
  let loaded: HTMLImageElement | null = null;
  try {
    loaded = await loadImage(url, limits.maxPixels, !svg);
    await loaded.decode().catch(() => {});
    const originalWidth = svgSize?.width ?? loaded.naturalWidth;
    const originalHeight = svgSize?.height ?? loaded.naturalHeight;
    if (!(originalWidth > 0 && originalHeight > 0)) throw new IconSourceError("decode");
    const size = workingSize(originalWidth, originalHeight, svg);
    const image = toWorkingCanvas(loaded, size);
    return {
      image,
      width: image.width,
      height: image.height,
      originalWidth,
      originalHeight,
      isSvg: svg,
      svgText,
      fileName: file.name,
    };
  } catch (error) {
    throw error instanceof IconSourceError ? error : new IconSourceError("decode");
  } finally {
    // 元画像の <img> と Blob URL はすぐ手放す（以降は作業用 canvas だけを使う）
    if (loaded) loaded.src = "";
    URL.revokeObjectURL(url);
  }
}
