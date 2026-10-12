import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { THEME_INIT_SCRIPT } from "~/theme/theme";
import {
  buildCsp,
  buildHeadersFile,
  cspHash,
  extractInlineScripts,
  inlineScriptHashes,
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
      '<script src="/image-adjust/assets/a.js"></script>',
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

  it("CSP に WASM・Worker・クリックジャッキング対策の指定が入る", () => {
    const csp = buildCsp(["'sha256-abc'"]);
    expect(csp).toMatch(/script-src 'self' 'wasm-unsafe-eval' 'sha256-abc' /);
    expect(csp).toContain("https://pagead2.googlesyndication.com");
    expect(csp).toContain("https://static.cloudflareinsights.com");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("worker-src 'self' blob:");
    expect(csp).toMatch(/img-src 'self' blob: data:/);
    expect(csp).toMatch(/connect-src 'self'/);
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it("_headers はページごとの CSP と共通のヘッダーを書く", () => {
    const file = buildHeadersFile("/image-adjust", [
      { urlPath: "/image-adjust/about/", html: "<script>a()</script>" },
      { urlPath: "/image-adjust/", html: "<script>b()</script>" },
    ]);
    expect(file).toContain("/image-adjust/*\n  X-Content-Type-Options: nosniff");
    expect(file).toContain(`/image-adjust/about/\n  Content-Security-Policy: `);
    expect(file).toContain(cspHash("a()"));
    // CSP は完全一致のルールにだけ書く（ワイルドカードのルールと値が連結されないように）
    const wildcard = file.split("\n\n").find((rule) => rule.startsWith("/image-adjust/*"));
    expect(wildcard).not.toContain("Content-Security-Policy");
  });
});
