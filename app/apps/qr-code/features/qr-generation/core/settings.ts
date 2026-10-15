/** 設定の検証（純粋関数）。保存された値・外部から渡された値を正しい設定へ直す。 */
import {
  DEFAULT_QR_SETTINGS,
  ICON_SIZE_PERCENT_DEFAULT,
  ICON_SIZE_PERCENT_MAX,
  ICON_SIZE_PERCENT_MIN,
  PNG_SIZES,
  type PngSize,
  type QrSettings,
} from "../../../domain/qr-settings";
import { evaluateForegroundColor, formatHexColor } from "./color";

export { DEFAULT_QR_SETTINGS };

function oneOfPngSize(value: unknown): PngSize | null {
  return PNG_SIZES.includes(value as PngSize) ? (value as PngSize) : null;
}

/** 前景色を検証する。`#rrggbb` で白背景とのコントラスト比が基準以上なら正規化して返す */
export function normalizeForegroundColor(value: unknown): string {
  const normalized = formatHexColor(value);
  if (!normalized) return DEFAULT_QR_SETTINGS.foreground;
  return evaluateForegroundColor(normalized).ok ? normalized : DEFAULT_QR_SETTINGS.foreground;
}

/** アイコンサイズ（百分率）を範囲内の整数へ丸める */
export function normalizeIconSizePercent(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return ICON_SIZE_PERCENT_DEFAULT;
  }
  const rounded = Math.round(value);
  return Math.min(ICON_SIZE_PERCENT_MAX, Math.max(ICON_SIZE_PERCENT_MIN, rounded));
}

/** 不正な項目だけを既定値に戻す（他の項目は残す） */
export function validateQrSettings(value: unknown): QrSettings {
  const input = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    foreground: normalizeForegroundColor(input.foreground),
    pngSize: oneOfPngSize(input.pngSize) ?? DEFAULT_QR_SETTINGS.pngSize,
    iconSizePercent: normalizeIconSizePercent(input.iconSizePercent),
  };
}

/** 1 項目を変えた設定（値は検証する） */
export function updateQrSetting<K extends keyof QrSettings>(
  settings: QrSettings,
  key: K,
  value: unknown,
): QrSettings {
  return validateQrSettings({ ...settings, [key]: value });
}
