/** feature 内の純粋関数を DOM なしで検証する。 */
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../../../domain/document-settings";
import { updateSetting, validateSettings } from "../core/settings";

describe("設定の検証", () => {
  it("不正な項目だけを既定値に戻す", () => {
    expect(validateSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(validateSettings("x")).toEqual(DEFAULT_SETTINGS);
    expect(
      validateSettings({
        paper: "letter",
        orientation: "sideways",
        margin: "wide",
        fontSize: 13,
        fontFamily: "mincho",
        pageBreakOnRule: "yes",
      }),
    ).toEqual({
      paper: "letter",
      orientation: DEFAULT_SETTINGS.orientation,
      margin: "wide",
      fontSize: DEFAULT_SETTINGS.fontSize,
      fontFamily: "mincho",
      pageBreakOnRule: DEFAULT_SETTINGS.pageBreakOnRule,
    });
  });

  it("1 項目を変える（値は検証する）", () => {
    expect(updateSetting(DEFAULT_SETTINGS, "fontSize", 14).fontSize).toBe(14);
    expect(updateSetting(DEFAULT_SETTINGS, "fontSize", 99).fontSize).toBe(
      DEFAULT_SETTINGS.fontSize,
    );
    expect(updateSetting(DEFAULT_SETTINGS, "pageBreakOnRule", false).pageBreakOnRule).toBe(false);
  });
});
