/** QR の配置（余白と中央アイコンの領域）を決める純粋な計算。 */
import { ICON_PADDING_MODULES, QR_QUIET_ZONE_MODULES } from "../../../domain/qr-settings";

/** 符号化で得たモジュール行列（row = y, col = x。1 が暗） */
export interface QrMatrixLike {
  readonly size: number;
  isDark(row: number, col: number): boolean;
}

/** 中央アイコンの領域（記号内のモジュール座標） */
export interface IconBox {
  /** アイコン本体の左上（x = 列） */
  x: number;
  /** アイコン本体の左上（y = 行） */
  y: number;
  /** アイコン本体の一辺 */
  size: number;
  /** アイコンの周りに付ける白い台座の幅 */
  pad: number;
}

export interface QrLayout {
  /** 余白を含まないモジュール数 */
  moduleCount: number;
  quietZone: number;
  /** 余白を含む一辺のモジュール数（SVG の viewBox の大きさ） */
  extent: number;
  /** 中央アイコンの領域（無ければ null） */
  icon: IconBox | null;
  /** 記号内の座標（x = 列, y = 行）が暗いか。記号の外・アイコン領域は常に false */
  isDark(x: number, y: number): boolean;
}

/** アイコンと台座がはみ出さない範囲で、中央に置く領域を求める（置けなければ null） */
export function computeIconBox(moduleCount: number, iconSizePercent: number): IconBox | null {
  if (!Number.isFinite(moduleCount) || moduleCount <= 0) return null;
  if (!Number.isFinite(iconSizePercent) || iconSizePercent <= 0) return null;

  const size = Math.round((moduleCount * iconSizePercent) / 100);
  if (size < 3) return null;
  const pad = ICON_PADDING_MODULES;
  if (size + pad * 2 > moduleCount) return null;

  return {
    x: Math.floor((moduleCount - size) / 2),
    y: Math.floor((moduleCount - size) / 2),
    size,
    pad,
  };
}

function containsIcon(icon: IconBox, x: number, y: number): boolean {
  const left = icon.x - icon.pad;
  const top = icon.y - icon.pad;
  const right = icon.x + icon.size + icon.pad;
  const bottom = icon.y + icon.size + icon.pad;
  return x >= left && x < right && y >= top && y < bottom;
}

/** 行列と設定から、余白とアイコン領域を反映した配置を組み立てる */
export function buildQrLayout(
  matrix: QrMatrixLike,
  options: { quietZone?: number; iconSizePercent?: number | null } = {},
): QrLayout {
  const moduleCount = matrix.size;
  const quietZone = options.quietZone ?? QR_QUIET_ZONE_MODULES;
  const icon =
    options.iconSizePercent == null ? null : computeIconBox(moduleCount, options.iconSizePercent);

  return {
    moduleCount,
    quietZone,
    extent: moduleCount + quietZone * 2,
    icon,
    isDark(x: number, y: number): boolean {
      if (!Number.isInteger(x) || !Number.isInteger(y)) return false;
      if (x < 0 || y < 0 || x >= moduleCount || y >= moduleCount) return false;
      if (icon && containsIcon(icon, x, y)) return false;
      return matrix.isDark(y, x);
    },
  };
}
