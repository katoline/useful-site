/**
 * アイコン内での元画像の配置（純粋な計算。canvas に依存しない）。
 */
import { OG_ICON_RATIO, type PngSpec } from "./specs";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * maskable アイコンのセーフゾーン（中心からの円。直径はアイコンの一辺の 80%）。
 * https://www.w3.org/TR/appmanifest/#icon-masks
 */
export const MASKABLE_SAFE_ZONE_DIAMETER = 0.8;

/** アスペクト比を保って box に収める（contain）。中央に置く */
export function fitContain(srcWidth: number, srcHeight: number, box: Rect): Rect {
  const sw = srcWidth > 0 ? srcWidth : 1;
  const sh = srcHeight > 0 ? srcHeight : 1;
  const scale = Math.min(box.width / sw, box.height / sh);
  const width = sw * scale;
  const height = sh * scale;
  return {
    x: box.x + (box.width - width) / 2,
    y: box.y + (box.height - height) / 2,
    width,
    height,
  };
}

/** 一辺 size の正方形に、余白 padding（割合）を空けて元画像を置く */
export function iconContentRect(
  size: number,
  padding: number,
  srcWidth: number,
  srcHeight: number,
): Rect {
  const inset = size * padding;
  return fitContain(srcWidth, srcHeight, {
    x: inset,
    y: inset,
    width: size - inset * 2,
    height: size - inset * 2,
  });
}

/**
 * maskable 用の配置。通常の配置（余白込み）の外接矩形がセーフゾーンの円に入るまで縮める。
 * 余白を十分取っていれば通常と同じ大きさのまま（拡大はしない）。
 */
export function maskableContentRect(
  size: number,
  padding: number,
  srcWidth: number,
  srcHeight: number,
): Rect {
  const base = iconContentRect(size, padding, srcWidth, srcHeight);
  const radius = (size * MASKABLE_SAFE_ZONE_DIAMETER) / 2;
  const halfDiagonal = Math.hypot(base.width, base.height) / 2;
  const scale = halfDiagonal > radius ? radius / halfDiagonal : 1;
  const width = base.width * scale;
  const height = base.height * scale;
  return { x: (size - width) / 2, y: (size - height) / 2, width, height };
}

/** OGP 画像の中に置くアイコン（正方形）の位置 */
export function ogIconRect(spec: Pick<PngSpec, "width" | "height">): Rect {
  const side = Math.round(spec.height * OG_ICON_RATIO);
  return {
    x: Math.round((spec.width - side) / 2),
    y: Math.round((spec.height - side) / 2),
    width: side,
    height: side,
  };
}
