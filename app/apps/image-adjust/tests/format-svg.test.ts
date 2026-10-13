import { describe, expect, it } from "vitest";
import { detectFormat } from "../domain/format";

describe("SVG の UTF-8 判定", () => {
  it("BOM と Unicode の空白を読み飛ばす", () => {
    for (const text of [
      '\ufeff\u3000<svg xmlns="http://www.w3.org/2000/svg"/>',
      '\u00a0\u2003<?xml version="1.0"?><!-- 日本語 --><svg/>',
    ]) {
      expect(detectFormat(new TextEncoder().encode(text))).toBe("svg");
    }
  });
  it("テキストの先頭がタグでなければ SVG とみなさない", () => {
    expect(detectFormat(new TextEncoder().encode("説明 <svg/>"))).toBeNull();
  });
});
