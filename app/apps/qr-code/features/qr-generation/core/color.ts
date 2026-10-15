/** 色の解析とコントラスト比の計算（純粋関数）。 */
import { MIN_COLOR_CONTRAST } from "../../../domain/qr-settings";

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const HEX_COLOR = /^#([0-9a-f]{6})$/i;

/** `#rrggbb` だけを受け付ける（`#rgb`・名前・rgb() は不可） */
export function parseHexColor(value: unknown): Rgb | null {
  if (typeof value !== "string") return null;
  const match = HEX_COLOR.exec(value.trim());
  if (!match) return null;
  const hex = match[1] ?? "";
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

/** `#rrggbb` に正規化する（解析できなければ null） */
export function formatHexColor(value: unknown): string | null {
  const rgb = parseHexColor(value);
  if (!rgb) return null;
  const part = (n: number) => n.toString(16).padStart(2, "0");
  return `#${part(rgb.r)}${part(rgb.g)}${part(rgb.b)}`;
}

function channelToLinear(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG の相対輝度（0〜1） */
export function relativeLuminance(rgb: Rgb): number {
  return (
    0.2126 * channelToLinear(rgb.r) +
    0.7152 * channelToLinear(rgb.g) +
    0.0722 * channelToLinear(rgb.b)
  );
}

/** 2 色のコントラスト比（1〜21） */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

const WHITE: Rgb = { r: 255, g: 255, b: 255 };

export interface ColorEvaluation {
  /** 白背景に対してコントラスト比の基準を満たすか */
  ok: boolean;
  /** 白背景に対するコントラスト比（解析できなければ 0） */
  contrast: number;
}

/** 前景色を白背景と比べて評価する（`#rrggbb` 以外は ok=false・contrast=0） */
export function evaluateForegroundColor(value: unknown): ColorEvaluation {
  const rgb = parseHexColor(value);
  if (!rgb) return { ok: false, contrast: 0 };
  const contrast = contrastRatio(rgb, WHITE);
  return { ok: contrast >= MIN_COLOR_CONTRAST, contrast };
}
