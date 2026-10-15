/** 出力解像度の判定（長い URL で小さい PNG は保存させない）。 */
import { describe, expect, it } from "vitest";
import { evaluateReadability } from "../core/readability";

describe("evaluateReadability", () => {
  it("短い URL は 256px でも足りる", () => {
    // version 3（29 モジュール）+ 余白 4×2 = 37、256/37 ≒ 6.9 px/モジュール
    const result = evaluateReadability({ moduleCount: 29, pngSize: 256 });
    expect(result.ok).toBe(true);
    expect(result.modulePixels).toBeCloseTo(256 / 37, 5);
    expect(result.minPngSize).toBe(256);
  });

  it("長い URL（version 40 相当）は 256px では足りず、最小サイズを案内する", () => {
    // 177 + 8 = 185、256/185 ≒ 1.38 px/モジュール
    const small = evaluateReadability({ moduleCount: 177, pngSize: 256 });
    expect(small.ok).toBe(false);
    expect(small.minPngSize).toBe(1024);
  });

  it("上限でも足りない場合は案内できる最小サイズが無い", () => {
    const result = evaluateReadability({ moduleCount: 600, pngSize: 2048 });
    expect(result.ok).toBe(false);
    expect(result.minPngSize).toBeNull();
  });

  it("大きいサイズなら長い URL でも足りる", () => {
    expect(evaluateReadability({ moduleCount: 177, pngSize: 2048 }).ok).toBe(true);
  });
});
