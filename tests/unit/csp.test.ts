// @vitest-environment happy-dom
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { THEME_INIT_SCRIPT } from "~/platform/theme/theme";
import {
  buildCsp,
  buildHeadersFile,
  cspHash,
  extractInlineScripts,
  HEADER_CSP,
  injectCspMeta,
  inlineScriptHashes,
  META_INVALID_DIRECTIVES,
} from "../../scripts/lib/csp";

describe("CSP のハッシュ", () => {
  it("中身の UTF-8 の SHA-256 を base64 にする", () => {
    const src = 'console.log("日本語")';
    const expected = createHash("sha256").update(Buffer.from(src, "utf8")).digest("base64");
    expect(cspHash(src)).toBe(`'sha256-${expected}'`);
    // 既知の値（空文字列の SHA-256）
    expect(cspHash("")).toBe("'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='");
  });

  it("実行されるインラインスクリプトだけを拾う（src 付き・JSON-LD は除く）", () => {
    const html = [
      `<script>${THEME_INIT_SCRIPT}</script>`,
      '<script type="application/ld+json">{"@type":"Article"}</script>',
      '<script src="/assets/a.js"></script>',
      '<script type="module" async="">import "/x.js";</script>',
      '<script id="_R_">requestAnimationFrame(function(){})</script>',
    ].join("");
    expect(extractInlineScripts(html)).toEqual([
      THEME_INIT_SCRIPT,
      'import "/x.js";',
      "requestAnimationFrame(function(){})",
    ]);
    expect(inlineScriptHashes(`${html}<script>${THEME_INIT_SCRIPT}</script>`)).toHaveLength(3);
  });

  it("ページの CSP に WASM・Worker の指定が入り、meta で無効なディレクティブは入らない", () => {
    const csp = buildCsp(["'sha256-abc'"]);
    expect(csp).toMatch(/script-src 'self' 'wasm-unsafe-eval' 'sha256-abc' /);
    expect(csp).toContain("https://pagead2.googlesyndication.com");
    expect(csp).toContain("https://static.cloudflareinsights.com");
    expect(csp).toContain("worker-src 'self' blob:");
    expect(csp).toMatch(/img-src 'self' blob: data:/);
    expect(csp).toMatch(/connect-src 'self'/);
    expect(csp).not.toContain("'unsafe-eval'");
    for (const name of META_INVALID_DIRECTIVES) expect(csp).not.toContain(name);
  });
});

describe("CSP の meta", () => {
  const page = [
    '<!DOCTYPE html><html lang="ja"><head><meta charSet="utf-8"/><title>t</title>',
    `<script>${THEME_INIT_SCRIPT}</script>`,
    '<script type="application/ld+json">{"a":"</b>"}</script>',
    "</head><body><p>本文</p>",
    '<script>window.__x = "<\\/script>";</script>',
    '<script type="module">import "/assets/entry.js";</script>',
    "</body></html>",
  ].join("");

  function metaContent(html: string): string {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const meta = doc.querySelector('meta[http-equiv="Content-Security-Policy"]');
    return meta?.getAttribute("content") ?? "";
  }

  it("head の先頭（charset の直後）に入り、スクリプトより前にある", () => {
    const html = injectCspMeta(page);
    const doc = new DOMParser().parseFromString(html, "text/html");
    const children = [...doc.head.children];
    expect(children[0]?.getAttribute("charset")).toBe("utf-8");
    expect(children[1]?.getAttribute("http-equiv")).toBe("Content-Security-Policy");
    expect(html.indexOf('http-equiv="Content-Security-Policy"')).toBeLessThan(
      html.indexOf("<script"),
    );
  });

  it("charset の meta が無ければ head の最初の子になる", () => {
    const html = injectCspMeta("<html><head><title>t</title><script>a()</script></head></html>");
    expect(html).toMatch(/^<html><head><meta http-equiv="Content-Security-Policy" content="/);
  });

  it("実行されるインラインスクリプトのハッシュがすべて入り、HTML の他の部分は変わらない", () => {
    const html = injectCspMeta(page);
    const csp = metaContent(html);
    const hashes = inlineScriptHashes(page);
    expect(hashes).toHaveLength(3);
    expect(hashes).toContain(cspHash(THEME_INIT_SCRIPT));
    for (const hash of hashes) expect(csp).toContain(hash);
    expect(csp).toBe(buildCsp(hashes));
    // JSON-LD はハッシュしない
    expect(csp).not.toContain(cspHash('{"a":"</b>"}'));
    // meta を足すだけ（取り除けば元の HTML に戻る）
    expect(html.replace(/<meta http-equiv="Content-Security-Policy" content="[^"]*"\/>/, "")).toBe(
      page,
    );
    expect(extractInlineScripts(html)).toEqual(extractInlineScripts(page));
  });

  it("meta に frame-ancestors 等の無効なディレクティブが入らない", () => {
    const csp = metaContent(injectCspMeta(page));
    expect(csp).not.toContain("frame-ancestors");
    expect(csp).not.toContain("report-uri");
    expect(csp).not.toContain("sandbox");
  });

  it("二重には入れない", () => {
    expect(() => injectCspMeta(injectCspMeta(page))).toThrow();
  });
});

describe("_headers", () => {
  it("ワイルドカードに meta で効かない CSP と共通のヘッダーを書く", () => {
    const file = buildHeadersFile(
      "",
      // sw.js の扱いはアプリが持つ（アプリのビルド後フック）
      [{ path: "/image-adjust/sw.js", headers: ["Cache-Control: no-cache"] }],
    );
    expect(file).toContain(`/*\n  Content-Security-Policy: ${HEADER_CSP}\n`);
    expect(HEADER_CSP).toBe("frame-ancestors 'none'; object-src 'none'; base-uri 'self'");
    expect(file).toContain("  X-Content-Type-Options: nosniff");
    expect(file).toContain("/assets/*\n  Cache-Control: public, max-age=31536000, immutable");
    expect(file).toContain("/image-adjust/sw.js\n  Cache-Control: no-cache");
    // CSP はワイルドカードの 1 本だけ（同じヘッダーを複数ルールで付けると値が連結される）
    expect(file.match(/Content-Security-Policy/g)).toHaveLength(1);
  });

  it("ルール数はページ数に依存しない", () => {
    const rules = (file: string) =>
      file.split("\n").filter((line) => line && !line.startsWith(" ")).length;
    // ページを渡す引数自体が無い。アプリのルールだけが増える
    expect(rules(buildHeadersFile(""))).toBe(2);
    expect(rules(buildHeadersFile("", [{ path: "/a/sw.js", headers: ["X: y"] }]))).toBe(3);
  });

  it("ワイルドカード以外のルールに CSP を書くと失敗する", () => {
    expect(() =>
      buildHeadersFile("", [
        { path: "/a/", headers: ["Content-Security-Policy: default-src 'none'"] },
      ]),
    ).toThrow();
  });

  it("ルール数・行の長さの上限を超えると失敗する", () => {
    const many = Array.from({ length: 99 }, (_, i) => ({ path: `/r${i}`, headers: ["X: y"] }));
    expect(() => buildHeadersFile("", many)).toThrow(/上限/);
    expect(() =>
      buildHeadersFile("", [{ path: "/a", headers: [`X: ${"y".repeat(2000)}`] }]),
    ).toThrow();
  });
});
