/** 設定の既定値と検証（保存された値・URL 等の信用できない値を、正しい設定に直す） */
import {
  DEFAULT_SETTINGS,
  type DocumentSettings,
  FONT_FAMILIES,
  FONT_SIZES,
  MARGINS,
  ORIENTATIONS,
  PAPER_SIZES,
} from "../../../domain/document-settings";

export { DEFAULT_SETTINGS };

function oneOf<T>(values: readonly T[], value: unknown, fallback: T): T {
  return values.includes(value as T) ? (value as T) : fallback;
}

/** 不正な項目だけを既定値に戻す（他の項目は残す） */
export function validateSettings(value: unknown): DocumentSettings {
  const input = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    paper: oneOf(PAPER_SIZES, input.paper, DEFAULT_SETTINGS.paper),
    orientation: oneOf(ORIENTATIONS, input.orientation, DEFAULT_SETTINGS.orientation),
    margin: oneOf(MARGINS, input.margin, DEFAULT_SETTINGS.margin),
    fontSize: oneOf(FONT_SIZES, input.fontSize, DEFAULT_SETTINGS.fontSize),
    fontFamily: oneOf(FONT_FAMILIES, input.fontFamily, DEFAULT_SETTINGS.fontFamily),
    pageBreakOnRule:
      typeof input.pageBreakOnRule === "boolean"
        ? input.pageBreakOnRule
        : DEFAULT_SETTINGS.pageBreakOnRule,
  };
}

/** 1 項目を変えた設定（値は検証する） */
export function updateSetting<K extends keyof DocumentSettings>(
  settings: DocumentSettings,
  key: K,
  value: unknown,
): DocumentSettings {
  return validateSettings({ ...settings, [key]: value });
}
