/** 設定の検証（不正な項目だけ既定値へ戻す）。 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_QR_SETTINGS,
  ICON_SIZE_PERCENT_MAX,
  ICON_SIZE_PERCENT_MIN,
} from "../../../domain/qr-settings";
import {
  normalizeForegroundColor,
  normalizeIconSizePercent,
  updateQrSetting,
  validateQrSettings,
} from "../core/settings";

describe("validateQrSettings", () => {
  it("null や文字列は既定値", () => {
    expect(validateQrSettings(null)).toEqual(DEFAULT_QR_SETTINGS);
    expect(validateQrSettings("x")).toEqual(DEFAULT_QR_SETTINGS);
  });

  it("不正な項目だけ既定値に戻す", () => {
    expect(
      validateQrSettings({
        foreground: "#00ff00", // コントラスト不足
        pngSize: 300, // 許されないサイズ
        iconSizePercent: "big",
      }),
    ).toEqual(DEFAULT_QR_SETTINGS);
  });

  it("正しい値はそのまま残す", () => {
    expect(
      validateQrSettings({ foreground: "#1E3A8A", pngSize: 1024, iconSizePercent: 18 }),
    ).toEqual({ foreground: "#1e3a8a", pngSize: 1024, iconSizePercent: 18 });
  });

  it("アイコンサイズは範囲内の整数へ丸める", () => {
    expect(normalizeIconSizePercent(99)).toBe(ICON_SIZE_PERCENT_MAX);
    expect(normalizeIconSizePercent(0)).toBe(ICON_SIZE_PERCENT_MIN);
    expect(normalizeIconSizePercent(15.4)).toBe(15);
    expect(normalizeIconSizePercent(Number.NaN)).toBe(DEFAULT_QR_SETTINGS.iconSizePercent);
  });

  it("コントラストを満たさない前景色は既定色にする", () => {
    expect(normalizeForegroundColor("#eeeeee")).toBe(DEFAULT_QR_SETTINGS.foreground);
    expect(normalizeForegroundColor("not-a-color")).toBe(DEFAULT_QR_SETTINGS.foreground);
    expect(normalizeForegroundColor("#14532d")).toBe("#14532d");
  });

  it("1 項目を変える（値は検証する）", () => {
    expect(updateQrSetting(DEFAULT_QR_SETTINGS, "pngSize", 2048).pngSize).toBe(2048);
    expect(updateQrSetting(DEFAULT_QR_SETTINGS, "pngSize", 999).pngSize).toBe(
      DEFAULT_QR_SETTINGS.pngSize,
    );
  });
});
