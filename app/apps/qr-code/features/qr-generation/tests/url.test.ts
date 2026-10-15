/** URL の検証と UTF-8 バイト数の境界。 */
import { describe, expect, it } from "vitest";
import { MAX_URL_BYTES } from "../../../domain/qr-settings";
import { validateQrUrl } from "../core/url";
import { utf8ByteLength } from "../core/utf8";

describe("utf8ByteLength", () => {
  it("ASCII・多バイト・サロゲートを数える", () => {
    expect(utf8ByteLength("")).toBe(0);
    expect(utf8ByteLength("abc")).toBe(3);
    expect(utf8ByteLength("あ")).toBe(3);
    expect(utf8ByteLength("😀")).toBe(4);
    expect(utf8ByteLength("\uD800")).toBe(3); // 孤立サロゲートは U+FFFD 相当
  });
});

describe("validateQrUrl", () => {
  it("空欄・空白だけは empty", () => {
    expect(validateQrUrl("")).toMatchObject({ ok: false, error: "empty" });
    expect(validateQrUrl("   ")).toMatchObject({ ok: false, error: "empty" });
    expect(validateQrUrl(undefined)).toMatchObject({ ok: false, error: "empty" });
  });

  it("URL として解釈できない文字列は invalid", () => {
    expect(validateQrUrl("example.com")).toMatchObject({ ok: false, error: "invalid" });
    expect(validateQrUrl("https://")).toMatchObject({ ok: false, error: "invalid" });
  });

  it("http / https 以外は scheme", () => {
    expect(validateQrUrl("ftp://example.com")).toMatchObject({ ok: false, error: "scheme" });
    expect(validateQrUrl("javascript:alert(1)")).toMatchObject({ ok: false, error: "scheme" });
    expect(validateQrUrl("data:text/plain,hi")).toMatchObject({ ok: false, error: "scheme" });
    expect(validateQrUrl("mailto:a@example.com")).toMatchObject({ ok: false, error: "scheme" });
  });

  it("http / https は正規化して受け付ける", () => {
    expect(validateQrUrl("https://example.com/path?q=1#f")).toEqual({
      ok: true,
      url: "https://example.com/path?q=1#f",
      bytes: 30,
    });
    expect(validateQrUrl("http://example.com")).toMatchObject({
      ok: true,
      url: "http://example.com/",
    });
    expect(validateQrUrl("  https://example.com  ")).toMatchObject({ ok: true });
  });

  it("UTF-8 でちょうど 1000 バイトは通り、超えると too-long", () => {
    const prefix = "https://example.com/"; // 20 バイト
    const just = `https://example.com/${"a".repeat(MAX_URL_BYTES - prefix.length)}`;
    expect(utf8ByteLength(just)).toBe(MAX_URL_BYTES);
    expect(validateQrUrl(just)).toMatchObject({ ok: true, bytes: MAX_URL_BYTES });

    const over = `${just}a`;
    expect(validateQrUrl(over)).toMatchObject({ ok: false, error: "too-long" });
  });

  it("日本語（1 文字 3 バイト）でもバイト数で判定する", () => {
    const multibyte = `https://example.com/${"あ".repeat(326)}`; // 20 + 978 = 998
    expect(utf8ByteLength(multibyte)).toBe(998);
    expect(validateQrUrl(multibyte)).toMatchObject({ ok: true, bytes: 998 });
    expect(validateQrUrl(`${multibyte}あ`)).toMatchObject({ ok: false, error: "too-long" });
  });
});
