/** 中央アイコンの受理（信頼済み固定 SVG / 変換済み PNG data URL だけ）。 */
import { describe, expect, it } from "vitest";
import { MAX_ICON_DATA_URL_LENGTH } from "../../../domain/qr-settings";
import { isPngDataUrl, normalizeCenterIcon, parseTrustedSvgIcon } from "../core/icon";

/** simple-icons の GitHub を短くしたもの（実際のロゴと同じ形） */
const GITHUB_SVG =
  '<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>GitHub</title><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577"/></svg>';

const PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("parseTrustedSvgIcon", () => {
  it("信頼済み SVG は中身と viewBox を取り出す", () => {
    const parsed = parseTrustedSvgIcon(GITHUB_SVG);
    expect(parsed?.viewBox).toEqual({ x: 0, y: 0, width: 24, height: 24 });
    expect(parsed?.inner).toContain("<path d=");
  });

  it("スクリプト・外部参照・イベント属性を含む SVG は拒否する", () => {
    const wrap = (inner: string) =>
      `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
    expect(parseTrustedSvgIcon(wrap("<script>alert(1)</script><path d='M0 0'/>"))).toBeNull();
    expect(parseTrustedSvgIcon(wrap('<image href="https://evil.example/x.png"/>'))).toBeNull();
    expect(parseTrustedSvgIcon(wrap('<use href="#x"/>'))).toBeNull();
    expect(parseTrustedSvgIcon(wrap("<foreignObject><p>x</p></foreignObject>"))).toBeNull();
    expect(parseTrustedSvgIcon(wrap("<style>*{fill:url(https://evil)}</style>"))).toBeNull();
    expect(parseTrustedSvgIcon('<svg viewBox="0 0 24 24" onload="alert(1)"></svg>')).toBeNull();
    expect(parseTrustedSvgIcon(wrap('<path fill="url(#g)"/>'))).toBeNull();
  });

  it("viewBox が無い・数値でない・要素が違うものは拒否する", () => {
    expect(parseTrustedSvgIcon("<svg xmlns='http://www.w3.org/2000/svg'><path/></svg>")).toBeNull();
    expect(parseTrustedSvgIcon('<svg viewBox="0 0 24"><path/></svg>')).toBeNull();
    expect(parseTrustedSvgIcon('<svg viewBox="0 0 a b"><path/></svg>')).toBeNull();
    expect(parseTrustedSvgIcon('<svg viewBox="0 0 24 24"><path/></svg><svg></svg>')).toBeNull();
    expect(parseTrustedSvgIcon('<rect width="1"/>')).toBeNull();
    expect(parseTrustedSvgIcon("https://example.com/logo.svg")).toBeNull();
    expect(parseTrustedSvgIcon(null)).toBeNull();
  });
});

describe("isPngDataUrl", () => {
  it("PNG の base64 data URL だけを受け付ける", () => {
    expect(isPngDataUrl(PNG_DATA_URL)).toBe(true);
    expect(isPngDataUrl("data:image/jpeg;base64,AAAA")).toBe(false);
    expect(isPngDataUrl("data:image/svg+xml;base64,AAAA")).toBe(false);
    expect(isPngDataUrl("https://example.com/x.png")).toBe(false);
    expect(isPngDataUrl(`data:image/png;base64,${"A".repeat(MAX_ICON_DATA_URL_LENGTH)}`)).toBe(
      false,
    );
  });
});

describe("normalizeCenterIcon", () => {
  it("不正な入力はアイコン無しにする", () => {
    expect(normalizeCenterIcon(null)).toEqual({ kind: "none" });
    expect(normalizeCenterIcon({ kind: "none" })).toEqual({ kind: "none" });
    expect(normalizeCenterIcon({ kind: "svg", svg: "<script></script>" })).toEqual({
      kind: "none",
    });
    expect(normalizeCenterIcon({ kind: "png", dataUrl: "nope" })).toEqual({ kind: "none" });
  });

  it("正しい SVG / PNG は通す", () => {
    expect(normalizeCenterIcon({ kind: "svg", svg: GITHUB_SVG })).toMatchObject({ kind: "svg" });
    expect(normalizeCenterIcon({ kind: "png", dataUrl: PNG_DATA_URL })).toEqual({
      kind: "png",
      dataUrl: PNG_DATA_URL,
    });
  });
});
