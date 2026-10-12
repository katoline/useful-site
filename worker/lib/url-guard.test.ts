import { describe, expect, it } from "vitest";
import { ownHostSuffixes, parseAndCheckUrl, resolveRedirect } from "./url-guard";

const own = ownHostSuffixes(["image-adjust.myacct.workers.dev", "example.org"]);

function check(url: string) {
  const result = parseAndCheckUrl(url, own);
  return result.ok ? "ok" : result.error;
}

describe("url-guard", () => {
  it.each([
    "file:///etc/passwd",
    "ftp://example.com/a.png",
    "javascript:alert(1)",
    "data:image/png;base64,AAAA",
    "not a url",
    "",
    "   ",
    "http://user:pass@example.com/a.png",
    "http://user@example.com/a.png",
    `https://example.com/${"a".repeat(2100)}`,
  ])("不正な URL を invalid_url にする: %s", (url) => {
    expect(check(url)).toBe("invalid_url");
  });

  it.each([
    "http://127.0.0.1/",
    "http://2130706433/",
    "http://0x7f.1/",
    "http://0177.0.0.1/",
    "http://0x7f000001./",
    "http://%31%32%37.0.0.1/",
    "http://10.0.0.1/",
    "http://192.168.1.1/",
    "http://169.254.169.254/latest/meta-data/",
    "http://8.8.8.8/",
    "http://[::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://[fe80::1]/",
    "http://localhost/",
    "http://localhost./",
    "http://LOCALHOST/",
    "http://foo.localhost/",
    "http://foo.local/",
    "http://foo.internal/",
    "http://router.lan/",
    "http://nas.home.arpa/",
    "http://1.0.0.127.in-addr.arpa/",
    "http://intranet/",
    "http://intranet./",
    "http://127.0.0.1.nip.io/",
    "http://example.com:8080/",
    "https://example.com:80/",
    "http://example.com:443/",
    "http://example.com../",
    // 自ドメイン（SITE_ORIGIN 相当とその配下、workers.dev の同じアカウント）
    "https://image-adjust.myacct.workers.dev/image-adjust/api/health",
    "https://other-app.myacct.workers.dev/",
    "https://myacct.workers.dev/",
    "https://example.org/",
    "https://www.example.org/",
    "https://api.example.org./",
    "https://EXAMPLE.ORG/",
  ])("禁止ホストを forbidden_host にする: %s", (url) => {
    expect(check(url)).toBe("forbidden_host");
  });

  it.each([
    "https://example.com/a.png",
    "http://example.com/a.png",
    "https://example.com:443/a.png",
    "http://example.com:80/a.png",
    "https://example.com./a.png",
    "https://cdn.example.net/path/to/img.webp?x=1#frag",
    "https://☃.com/a.png",
    "https://other.workers.dev/a.png",
    "https://someone.otheracct.workers.dev/a.png",
    "  https://example.com/a.png  ",
  ])("通常の URL を許可する: %s", (url) => {
    expect(check(url)).toBe("ok");
  });

  it("www. 付きの SITE_ORIGIN は www を外したドメインごと自ドメインにする", () => {
    const suffixes = ownHostSuffixes(["www.mysite.jp"]);
    expect(parseAndCheckUrl("https://mysite.jp/", suffixes).ok).toBe(false);
    expect(parseAndCheckUrl("https://other.mysite.jp/", suffixes).ok).toBe(false);
    expect(parseAndCheckUrl("https://notmysite.jp/", suffixes).ok).toBe(true);
  });

  it("リダイレクトの相対 Location を解決してから検査する", () => {
    const base = new URL("https://example.com/a/b.png");
    const rel = resolveRedirect("../c.png", base, own);
    expect(rel.ok && rel.url.toString()).toBe("https://example.com/c.png");
    expect(resolveRedirect("//127.0.0.1/x", base, own)).toEqual({
      ok: false,
      error: "forbidden_host",
    });
    expect(resolveRedirect("http://localhost:8080/", base, own).ok).toBe(false);
    expect(resolveRedirect(null, base, own)).toEqual({ ok: false, error: "invalid_url" });
    expect(resolveRedirect("file:///etc/passwd", base, own)).toEqual({
      ok: false,
      error: "invalid_url",
    });
  });
});
