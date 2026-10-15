/**
 * 配置から SVG 文字列を組み立てる（純粋関数）。
 * 入る値は検証済みの色（`#rrggbb`）・整数・信頼済みのアイコンだけなので、
 * ユーザーが入力した URL や任意の文字列が SVG に混ざることはない。
 */
import { QR_BACKGROUND_COLOR } from "../../../domain/qr-settings";
import type { CenterIcon } from "./icon";
import type { QrLayout } from "./layout";

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function color(value: string): string {
  if (!HEX_COLOR.test(value)) throw new Error(`不正な色です: ${value}`);
  return value;
}

function num(value: number): string {
  if (!Number.isFinite(value)) throw new Error(`不正な数値です: ${value}`);
  return String(value);
}

export interface BuildQrSvgInput {
  layout: QrLayout;
  /** 前景色（`#rrggbb`） */
  foreground: string;
  /** 背景色（既定は白） */
  background?: string;
  icon?: CenterIcon;
  /** ルートの width / height（既定は viewBox と同じモジュール数） */
  intrinsicSize?: number;
  /**
   * 出力する PNG の一辺（px）。指定すると、その画素グリッドでモジュール幅が
   * 整数画素になるよう、QR 本体を中央へわずかに縮小する（白背景は全面のまま）。
   */
  pixelGridSize?: number;
}

/**
 * PNG の画素グリッド（一辺 `pixelGridSize` px）でモジュール幅が整数画素になる縮小率と、
 * 中央寄せのずらし量（どちらも viewBox のユーザー座標）を求める。
 * 1 モジュール = `floor(P / E)` 画素。収まらない余りは左右（上下）へ等分に配る。
 * 縮小できない（余白やモジュールが無い）ときは null（変換なし）。
 */
export function pixelGridTransform(
  extent: number,
  pixelGridSize?: number,
): { scale: number; offset: number } | null {
  if (pixelGridSize === undefined || !Number.isFinite(pixelGridSize)) return null;
  if (!Number.isFinite(extent) || extent <= 0) return null;
  const pixels = Math.floor(pixelGridSize);
  if (pixels <= 0) return null;

  const modulePixels = Math.floor(pixels / extent);
  if (modulePixels < 1) return null;

  const scale = (modulePixels * extent) / pixels;
  const offset = (Math.floor((pixels - modulePixels * extent) / 2) * extent) / pixels;
  return { scale, offset };
}

function iconElements(icon: CenterIcon, layout: QrLayout, foreground: string): string {
  const box = layout.icon;
  if (!box || icon.kind === "none") return "";

  const quiet = layout.quietZone;
  const x = box.x + quiet;
  const y = box.y + quiet;
  const side = box.size + box.pad * 2;
  const parts = [
    `<rect x="${num(x - box.pad)}" y="${num(y - box.pad)}" width="${num(side)}" height="${num(side)}" fill="${color(QR_BACKGROUND_COLOR)}"/>`,
  ];

  if (icon.kind === "svg") {
    const { viewBox } = icon;
    const box4 = [viewBox.x, viewBox.y, viewBox.width, viewBox.height].map(num).join(" ");
    parts.push(
      `<svg x="${num(x)}" y="${num(y)}" width="${num(box.size)}" height="${num(box.size)}" viewBox="${box4}" fill="${color(foreground)}" preserveAspectRatio="xMidYMid meet">${icon.inner}</svg>`,
    );
  } else {
    parts.push(
      `<image x="${num(x)}" y="${num(y)}" width="${num(box.size)}" height="${num(box.size)}" href="${icon.dataUrl}" preserveAspectRatio="xMidYMid meet"/>`,
    );
  }

  return parts.join("");
}

/** 符号化済みの配置と設定から SVG 文字列を作る */
export function buildQrSvg({
  layout,
  foreground,
  background = QR_BACKGROUND_COLOR,
  icon = { kind: "none" },
  intrinsicSize,
  pixelGridSize,
}: BuildQrSvgInput): string {
  const fill = color(foreground);
  const bg = color(background);
  const { moduleCount, quietZone, extent } = layout;

  let path = "";
  for (let y = 0; y < moduleCount; y++) {
    for (let x = 0; x < moduleCount; x++) {
      if (layout.isDark(x, y)) path += `M${x + quietZone} ${y + quietZone}h1v1h-1z`;
    }
  }

  const size = num(intrinsicSize ?? extent);
  const paths = path === "" ? "" : `<path fill="${fill}" d="${path}"/>`;
  const drawable = `${paths}${iconElements(icon, layout, fill)}`;
  const transform = pixelGridTransform(extent, pixelGridSize);
  const body = transform
    ? `<g transform="translate(${num(transform.offset)} ${num(transform.offset)}) scale(${num(transform.scale)})">${drawable}</g>`
    : drawable;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${num(extent)} ${num(extent)}" shape-rendering="crispEdges" role="img" aria-label="QR code">`,
    `<rect width="${num(extent)}" height="${num(extent)}" fill="${bg}"/>`,
    body,
    "</svg>",
  ].join("");
}
