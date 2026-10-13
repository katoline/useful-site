/** core（純粋関数）の単体テスト。DOM なしの node 環境で動かす（feature の外なので index から import する） */
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, type DocumentSettings } from "../domain/document-settings";
import { MAX_IMAGE_COUNT, MAX_IMAGE_TOTAL_BYTES, MAX_TEXT_BYTES } from "../domain/limits";
import {
  acceptImages,
  checkTextFile,
  classifyFiles,
  isTextWithinLimit,
  mergeImages,
  utf8ByteLength,
} from "../features/document-input";
import {
  buildDocumentCss,
  buildPageRule,
  buildPrintDocument,
  documentTitle,
  extractFirstHeading,
  markdownFileName,
  PREVIEW_CSP,
  toFileName,
} from "../features/print";
import { isAllowedUrl, normalizeImagePath, resolveImageSource } from "../features/render";
import { updateSetting, validateSettings } from "../features/settings";

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
