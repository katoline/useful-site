/** feature 内の純粋関数を DOM なしで検証する。 */
import { describe, expect, it } from "vitest";
import { MAX_IMAGE_COUNT, MAX_IMAGE_TOTAL_BYTES, MAX_TEXT_BYTES } from "../../../domain/limits";
import {
  acceptImages,
  checkTextFile,
  classifyFiles,
  isTextWithinLimit,
  mergeImages,
  utf8ByteLength,
} from "../core/validate";

describe("入力の上限・拡張子", () => {
  it("文書は .md・.markdown・.txt で 2MB まで", () => {
    expect(checkTextFile({ name: "a.MD", size: 10 })).toEqual({ ok: true });
    expect(checkTextFile({ name: "a.markdown", size: MAX_TEXT_BYTES })).toEqual({ ok: true });
    expect(checkTextFile({ name: "a.txt", size: MAX_TEXT_BYTES + 1 })).toEqual({
      ok: false,
      reason: "tooLarge",
    });
    expect(checkTextFile({ name: "a.html", size: 1 })).toEqual({ ok: false, reason: "extension" });
    expect(checkTextFile({ name: ".md", size: 1 })).toEqual({ ok: false, reason: "extension" });
  });

  it("テキストの長さは UTF-8 のバイト数で数える", () => {
    expect(utf8ByteLength("aé日😀")).toBe(1 + 2 + 3 + 4);
    expect(isTextWithinLimit("a".repeat(MAX_TEXT_BYTES))).toBe(true);
    expect(isTextWithinLimit("a".repeat(MAX_TEXT_BYTES + 1))).toBe(false);
    expect(isTextWithinLimit("あ".repeat(Math.floor(MAX_TEXT_BYTES / 3) + 1))).toBe(false);
  });

  it("文書・画像・その他に分ける", () => {
    const files = [
      { name: "a.md", size: 1 },
      { name: "b.PNG", size: 1 },
      { name: "c.pdf", size: 1 },
    ];
    expect(classifyFiles(files)).toEqual({
      texts: [files[0]],
      images: [files[1]],
      unsupported: [files[2]],
    });
  });

  it("画像は 50 枚・合計 20MB まで。超える分は読み込まない", () => {
    const many = Array.from({ length: MAX_IMAGE_COUNT + 2 }, (_, i) => ({
      name: `${i}.png`,
      size: 1,
    }));
    const result = acceptImages([], many);
    expect(result.accepted).toHaveLength(MAX_IMAGE_COUNT);
    expect(result.rejected.map((r) => r.reason)).toEqual(["count", "count"]);

    const big = [
      { name: "a.png", size: MAX_IMAGE_TOTAL_BYTES - 10 },
      { name: "b.png", size: 11 },
      { name: "c.png", size: 10 },
    ];
    const sized = acceptImages([], big);
    expect(sized.accepted.map((f) => f.name)).toEqual(["a.png", "c.png"]);
    expect(sized.rejected).toEqual([{ file: big[1], reason: "totalSize" }]);
    expect(acceptImages([], [{ name: "x.bmp", size: 1 }]).rejected[0]?.reason).toBe("extension");
  });

  it("同じ名前の画像は置き換え、枚数・サイズに二重に数えない", () => {
    const current = [{ name: "a.png", size: MAX_IMAGE_TOTAL_BYTES }];
    const replacement = { name: "a.png", size: 5 };
    expect(acceptImages(current, [replacement]).accepted).toEqual([replacement]);
    expect(mergeImages(current, [replacement])).toEqual([replacement]);
    expect(mergeImages([{ name: "a.png", size: 1 }], [{ name: "b.png", size: 2 }])).toHaveLength(2);
  });
});
