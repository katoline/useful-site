/** 色の解析とコントラスト比。 */
import { describe, expect, it } from "vitest";
import { MIN_COLOR_CONTRAST, QR_FOREGROUND_PRESETS } from "../../../domain/qr-settings";
import {
  evaluateForegroundColor,
  formatHexColor,
  parseHexColor,
  relativeLuminance,
} from "../core/color";

describe("parseHexColor", () => {
  it("#rrggbb だけを受け付ける", () => {
    expect(parseHexColor("#ffffff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHexColor(" #1E3A8A ")).toEqual({ r: 30, g: 58, b: 138 });
    expect(parseHexColor("#fff")).toBeNull();
    expect(parseHexColor("rgb(0,0,0)")).toBeNull();
    expect(parseHexColor("white")).toBeNull();
    expect(parseHexColor("#gggggg")).toBeNull();
    expect(parseHexColor(123)).toBeNull();
  });

  it("小文字へ正規化する", () => {
    expect(formatHexColor("#1E3A8A")).toBe("#1e3a8a");
    expect(formatHexColor("nope")).toBeNull();
  });
});

describe("コントラスト比", () => {
  it("白と黒は 21:1", () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBe(0);
    expect(evaluateForegroundColor("#000000").contrast).toBeCloseTo(21, 5);
  });

  it("既知の値（#767676 と白は 4.54）", () => {
    expect(evaluateForegroundColor("#767676").contrast).toBeCloseTo(4.54, 1);
  });

  it("薄い色は基準を満たさない", () => {
    expect(evaluateForegroundColor("#ffffff")).toMatchObject({ ok: false });
    expect(evaluateForegroundColor("#cccccc").ok).toBe(false);
    expect(evaluateForegroundColor("#00ff00").ok).toBe(false);
    expect(evaluateForegroundColor("not-a-color")).toEqual({ ok: false, contrast: 0 });
  });
});

describe("プリセット", () => {
  it("すべて白背景に対してコントラスト基準を満たす", () => {
    for (const preset of QR_FOREGROUND_PRESETS) {
      const { ok, contrast } = evaluateForegroundColor(preset.color);
      expect(ok, `${preset.id} (${preset.color}) のコントラスト ${contrast}`).toBe(true);
      expect(contrast).toBeGreaterThanOrEqual(MIN_COLOR_CONTRAST);
    }
  });
});
