/** feature 内の純粋関数を DOM なしで検証する。 */
import { describe, expect, it } from "vitest";
import { isAllowedUrl, normalizeImagePath, resolveImageSource } from "../core/url-policy";

describe("リンク・画像の URL", () => {
  it("リンクは許可リスト（http(s)・mailto・tel・相対・画像の data:）", () => {
    for (const url of [
      "https://e.com",
      "http://e.com",
      "mailto:a@e.com",
      "tel:0",
      "#fn1",
      "./a.md",
      "?q",
    ])
      expect(isAllowedUrl(url), url).toBe(true);
    for (const url of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      " javascript:alert(1)",
      "java\tscript:alert(1)",
      "vbscript:msgbox",
      "file:///etc/passwd",
      "data:text/html,<script>alert(1)</script>",
      "data:image/svg",
      "blob:https://e.com/x",
    ])
      expect(isAllowedUrl(url), url).toBe(false);
    expect(isAllowedUrl("data:image/png;base64,AAAA")).toBe(true);
  });

  it("相対パスの画像は一緒に入れた画像の blob: URL に置き換える", () => {
    const images = new Map([
      ["photo.png", "blob:x/1"],
      ["img/Logo.SVG", "blob:x/2"],
    ]);
    expect(resolveImageSource("photo.png", images)).toEqual({ kind: "ok", src: "blob:x/1" });
    expect(resolveImageSource("./assets/photo.png?v=2#a", images)).toEqual({
      kind: "ok",
      src: "blob:x/1",
    });
    expect(resolveImageSource("img/../img/Logo.SVG", images)).toEqual({
      kind: "ok",
      src: "blob:x/2",
    });
    expect(resolveImageSource("logo.svg", images)).toEqual({ kind: "ok", src: "blob:x/2" });
    expect(resolveImageSource("photo%20.png", images)).toEqual({
      kind: "blocked",
      reason: "missing",
    });
    expect(resolveImageSource("none.png", images)).toEqual({ kind: "blocked", reason: "missing" });
    expect(normalizeImagePath("./a//b/../c%20d.png")).toBe("a/c d.png");
  });

  it("data: の画像は通し、外部 URL・他のスキームはブロックする", () => {
    const empty = new Map<string, string>();
    expect(resolveImageSource("data:image/png;base64,AAAA", empty)).toEqual({
      kind: "ok",
      src: "data:image/png;base64,AAAA",
    });
    expect(resolveImageSource("https://e.com/a.png", empty)).toEqual({
      kind: "blocked",
      reason: "external",
    });
    expect(resolveImageSource("//e.com/a.png", empty)).toEqual({
      kind: "blocked",
      reason: "external",
    });
    expect(resolveImageSource("data:text/html,x", empty)).toEqual({
      kind: "blocked",
      reason: "unsafe",
    });
    expect(
      resolveImageSource("blob:https://e.com/1", new Map([["blob:https://e.com/1", "x"]])),
    ).toEqual({
      kind: "blocked",
      reason: "unsafe",
    });
  });
});
