/** feature 内の純粋関数を DOM なしで検証する。 */
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, type DocumentSettings } from "../../../domain/document-settings";
import { buildDocumentCss, buildPageRule, buildPrintDocument, PREVIEW_CSP } from "../core/document";
import {
  documentTitle,
  extractFirstHeading,
  markdownFileName,
  toFileName,
} from "../core/file-name";

const settings = (patch: Partial<DocumentSettings> = {}): DocumentSettings => ({
  ...DEFAULT_SETTINGS,
  ...patch,
});

describe("印刷用の CSS（@page）", () => {
  it("用紙・向き・余白を @page に入れる", () => {
    expect(buildPageRule(settings())).toBe("@page { size: A4 portrait; margin: 20mm; }");
    expect(
      buildPageRule(settings({ paper: "letter", orientation: "landscape", margin: "narrow" })),
    ).toBe("@page { size: letter landscape; margin: 10mm; }");
    expect(buildPageRule(settings({ margin: "wide" }))).toContain("margin: 30mm;");
  });

  it("画面では用紙の幅の紙として表示し、横向きは幅と高さを入れ替える", () => {
    expect(buildDocumentCss(settings())).toContain("width: 210mm; min-height: 297mm;");
    expect(buildDocumentCss(settings({ orientation: "landscape" }))).toContain(
      "width: 297mm; min-height: 210mm;",
    );
    expect(buildDocumentCss(settings({ paper: "letter" }))).toContain("width: 215.9mm;");
  });

  it("文字サイズと書体を反映する", () => {
    expect(buildDocumentCss(settings({ fontSize: 14 }))).toContain("font-size: 14pt;");
    expect(buildDocumentCss(settings({ fontFamily: "mincho" }))).toMatch(/Mincho[^;]*serif;/);
    expect(buildDocumentCss(settings({ fontFamily: "gothic" }))).toMatch(/Gothic[^;]*sans-serif;/);
  });

  it("--- の改ページは設定でオン・オフでき、脚注の区切り線では改ページしない", () => {
    const on = buildDocumentCss(settings({ pageBreakOnRule: true }));
    expect(on).toContain("hr:not(.footnotes-sep) { break-after: page;");
    expect(buildDocumentCss(settings({ pageBreakOnRule: false }))).not.toContain(
      "break-after: page",
    );
  });

  it("見出しの直後・表の行・コードを分断しにくくし、印刷は白地に黒", () => {
    const css = buildDocumentCss(settings());
    expect(css).toMatch(/h1, h2, h3, h4, h5, h6 \{[^}]*break-after: avoid/);
    expect(css).toMatch(/tr, img, pre[^{]*\{[^}]*break-inside: avoid/);
    expect(css).toContain("th, td { border: 1px solid");
    expect(css).toMatch(/code, kbd, pre, samp \{ font-family: ui-monospace/);
    expect(css).toContain("color-scheme: light");
    expect(css).toContain("background: #fff; color: #111;");
  });

  it("文書の head の先頭に CSP を置き、タイトルはエスケープする", () => {
    const html = buildPrintDocument({
      bodyHtml: "<p>本文</p>",
      settings: settings(),
      title: '</title><script>alert(1)</script>"',
      lang: "ja",
    });
    expect(html).toMatch(
      /^<!doctype html>\n<html lang="ja">\n<head>\n<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'">/,
    );
    expect(PREVIEW_CSP).toBe("default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'");
    expect(html).toContain(
      "<title>&lt;/title&gt;&lt;script&gt;alert(1)&lt;/script&gt;&quot;</title>",
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("<body>\n<p>本文</p>\n</body>");
  });
});

describe("保存名（最初の h1）", () => {
  it("ATX と Setext の h1 を見つけ、h2 やコードブロックの中は見ない", () => {
    expect(extractFirstHeading("## 小見出し\n# 本当のタイトル #\n# 次")).toBe("本当のタイトル");
    expect(extractFirstHeading("前置き\n\nSetext の題\n===\n# ATX")).toBe("Setext の題");
    expect(extractFirstHeading("```\n# コードの中\n```\n# 外")).toBe("外");
    expect(extractFirstHeading("~~~md\n# 中\n~~~\n")).toBeNull();
    expect(extractFirstHeading("#ハッシュだけ\n#\n本文")).toBeNull();
    expect(extractFirstHeading("")).toBeNull();
  });

  it("見出しの記法を外す", () => {
    expect(extractFirstHeading("# **太字** と `code` と [リンク](https://e.com)[^1]")).toBe(
      "太字 と code と リンク",
    );
  });

  it("ファイル名に使えない文字を除き、長さを制限し、無ければ既定名", () => {
    expect(toFileName('a/b\\c:d*e?f"g<h>i|j', "x")).toBe("a b c d e f g h i j");
    expect(toFileName("  ..秘密.. ", "x")).toBe("秘密");
    expect(toFileName("line\u0000break\u001f", "x")).toBe("line break");
    expect(toFileName(null, "文書")).toBe("文書");
    expect(toFileName("...", "文書")).toBe("文書");
    expect([...toFileName("あ".repeat(200), "x")]).toHaveLength(80);
    expect(documentTitle("本文だけ", "document")).toBe("document");
    expect(markdownFileName("# 議事録: 10/1", "document")).toBe("議事録 10 1.md");
  });
});
