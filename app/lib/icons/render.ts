/**
 * アイコンの描画（ブラウザ専用。OffscreenCanvas、無ければ <canvas>）。
 * 配置の計算は layout.ts、ファイルの一覧は specs.ts にある。
 */
import { iconContentRect, maskableContentRect, ogIconRect, type Rect } from "./layout";
import type { IconSettings } from "./settings";
import type { PngSpec } from "./specs";

/** 描画に必要な元画像の情報（IconSource の一部） */
export interface DrawableSource {
  image: CanvasImageSource;
  width: number;
  height: number;
  /** prepareSource() で作る縮小版の列（大きい順。先頭は image 自身） */
  levels?: MipLevel[];
}

export interface MipLevel {
  image: CanvasImageSource;
  width: number;
  height: number;
}

/** 縮小版の最小の辺（favicon 16px に余白 40% を付けたときの中身より小さく取る） */
const MIP_MIN_SIDE = 4;

/** 半分ずつ縮めた大きさの列（先頭は元の大きさ）。純粋関数 */
export function mipSizes(
  width: number,
  height: number,
  minSide = MIP_MIN_SIDE,
): { width: number; height: number }[] {
  const sizes = [{ width, height }];
  let w = width;
  let h = height;
  while (w / 2 >= minSide && h / 2 >= minSide) {
    w = Math.round(w / 2);
    h = Math.round(h / 2);
    sizes.push({ width: w, height: h });
  }
  return sizes;
}

/** rect に描くのに使う縮小版：rect 以上の大きさのうち最も小さいもの。純粋関数 */
export function pickLevel<T extends { width: number; height: number }>(
  levels: readonly T[],
  width: number,
  height: number,
): T {
  let picked = levels[0] as T;
  for (const level of levels) {
    if (level.width >= width && level.height >= height) picked = level;
  }
  return picked;
}

type AnyCanvas = OffscreenCanvas | HTMLCanvasElement;
type AnyContext = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

function createCanvas(width: number, height: number): { canvas: AnyCanvas; ctx: AnyContext } {
  const canvas: AnyCanvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(width, height)
      : Object.assign(document.createElement("canvas"), { width, height });
  const ctx = canvas.getContext("2d") as AnyContext | null;
  if (!ctx) throw new Error("canvas 2D を使えません");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return { canvas, ctx };
}

export async function canvasToPng(canvas: AnyCanvas): Promise<Uint8Array> {
  const blob =
    "convertToBlob" in canvas
      ? await canvas.convertToBlob({ type: "image/png" })
      : await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error("PNG にできません"))),
            "image/png",
          );
        });
  return new Uint8Array(await blob.arrayBuffer());
}

/** 角丸の矩形のパス（roundRect の無い環境でも動くように自前で引く） */
function roundRectPath(ctx: AnyContext, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/**
 * 縮小版の列を 1 回だけ作る（一度に 1/32 などへ縮めると、16px の favicon でジャギーやモアレが出やすい。
 * かといって描くたびに縮め直すと canvas を大量に作ってメモリを使い切る）。
 * 使い終わったら releasePreparedSource() で解放する。
 */
export function prepareSource(source: DrawableSource): DrawableSource {
  const sizes = mipSizes(source.width, source.height);
  const levels: MipLevel[] = [{ image: source.image, width: source.width, height: source.height }];
  for (const size of sizes.slice(1)) {
    const prev = levels[levels.length - 1] as MipLevel;
    const step = createCanvas(size.width, size.height);
    step.ctx.drawImage(prev.image, 0, 0, size.width, size.height);
    levels.push({ image: step.canvas, ...size });
  }
  return { ...source, levels };
}

/** prepareSource() で作った canvas を解放する（元の image には触れない） */
export function releasePreparedSource(source: DrawableSource): void {
  for (const level of source.levels?.slice(1) ?? []) {
    const canvas = level.image as AnyCanvas;
    canvas.width = 0;
    canvas.height = 0;
  }
}

/** 元画像を rect に描く（縮小版があれば、rect に合うものを使う） */
function drawSource(ctx: AnyContext, source: DrawableSource, rect: Rect) {
  if (rect.width <= 0 || rect.height <= 0) return;
  const level = source.levels
    ? pickLevel(source.levels, rect.width, rect.height)
    : { image: source.image };
  ctx.drawImage(level.image, rect.x, rect.y, rect.width, rect.height);
}

/** 透過できないアイコン（apple・maskable・og）の背景色 */
export function opaqueBackground(settings: IconSettings): string {
  return settings.background ?? settings.backgroundColor;
}

/** 設定どおりの正方形アイコン（favicon / any） */
function drawStandardIcon(
  ctx: AnyContext,
  source: DrawableSource,
  settings: IconSettings,
  x: number,
  y: number,
  size: number,
) {
  ctx.save();
  if (settings.radius > 0) {
    roundRectPath(ctx, x, y, size, size, size * settings.radius);
    ctx.clip();
  }
  if (settings.background) {
    ctx.fillStyle = settings.background;
    ctx.fillRect(x, y, size, size);
  }
  const rect = iconContentRect(size, settings.padding, source.width, source.height);
  drawSource(ctx, source, { ...rect, x: rect.x + x, y: rect.y + y });
  ctx.restore();
}

/** 1 枚分を描いた canvas を返す */
export function renderIcon(
  source: DrawableSource,
  spec: PngSpec,
  settings: IconSettings,
): AnyCanvas {
  const { canvas, ctx } = createCanvas(spec.width, spec.height);
  switch (spec.kind) {
    case "favicon":
    case "any":
      drawStandardIcon(ctx, source, settings, 0, 0, spec.width);
      break;
    case "apple": {
      ctx.fillStyle = opaqueBackground(settings);
      ctx.fillRect(0, 0, spec.width, spec.height);
      drawSource(
        ctx,
        source,
        iconContentRect(spec.width, settings.padding, source.width, source.height),
      );
      break;
    }
    case "maskable": {
      ctx.fillStyle = opaqueBackground(settings);
      ctx.fillRect(0, 0, spec.width, spec.height);
      drawSource(
        ctx,
        source,
        maskableContentRect(spec.width, settings.padding, source.width, source.height),
      );
      break;
    }
    case "og": {
      ctx.fillStyle = opaqueBackground(settings);
      ctx.fillRect(0, 0, spec.width, spec.height);
      const rect = ogIconRect(spec);
      drawStandardIcon(ctx, source, settings, rect.x, rect.y, rect.width);
      break;
    }
  }
  return canvas;
}

export async function renderIconPng(
  source: DrawableSource,
  spec: PngSpec,
  settings: IconSettings,
): Promise<Uint8Array> {
  return canvasToPng(renderIcon(source, spec, settings));
}
