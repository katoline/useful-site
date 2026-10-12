/**
 * fetch-image の取得先 URL の検査（SSRF・同居アプリへの踏み台化の防止。plan.md §3.5）。
 *
 * 判定はすべて WHATWG URL パーサで正規化した後の値で行う。
 * （IPv4 の 10 進・8 進・16 進・短縮表記や %エンコードはパーサが 127.0.0.1 のような
 * ドット区切り 10 進に直し、IPv6 は [..] 付きになるので、正規化後の形だけを見れば足りる）
 *
 * DNS で内部 IP に解決されるホスト名（DNS リバインディング等）はここでは防げない。
 * Workers の fetch は Cloudflare のエッジから出ていき、私設ネットワークや Cloudflare 内部には
 * 届かないため、名前の段階で明らかなものだけを拒否する方針にしている。
 */

export type UrlGuardError = "invalid_url" | "forbidden_host";

export type UrlGuardResult = { ok: true; url: URL } | { ok: false; error: UrlGuardError };

/** URL 文字列の長さの上限（ブラウザ・サーバーで扱いやすい範囲） */
export const MAX_URL_LENGTH = 2048;

/** 社内・ローカル向け、または予約済みの名前空間（この接尾辞、またはそれ自体を拒否） */
const BLOCKED_SUFFIXES = [
  "localhost",
  "localdomain",
  "local",
  "internal",
  "intranet",
  "lan",
  "home",
  "corp",
  "private",
  "home.arpa",
  // in-addr.arpa・ip6.arpa 等も含めて逆引き用の名前空間はまとめて拒否
  "arpa",
  // RFC 2606 / 6761 の予約名
  "test",
  "invalid",
  "example",
  "onion",
  "alt",
  // 名前に IP を埋め込むと任意の IP に解決させられる公開サービス（127.0.0.1.nip.io 等）
  "nip.io",
  "sslip.io",
  "xip.io",
  "localtest.me",
  "lvh.me",
];

/** ホスト名の 1 ラベルとして許す文字（パーサが punycode 化した後の ASCII） */
const LABEL_RE = /^[a-z0-9_](?:[a-z0-9_-]*[a-z0-9_])?$/;

/** 数値として読める最後のラベル（パーサが IPv4 として扱う形。念のため正規化後にも見る） */
const NUMERIC_LABEL_RE = /^(?:0x[0-9a-f]*|[0-9]+)$/;

/** 末尾ドットを 1 つだけ外す（`example.com.` は `example.com` と同じ名前） */
export function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/\.$/, "");
}

function matchesSuffix(host: string, suffix: string): boolean {
  return host === suffix || host.endsWith(`.${suffix}`);
}

/**
 * 自分のドメインとして扱うホスト名の一覧を作る。
 * - SITE_ORIGIN のホスト（先頭の www. は外す）とそのサブドメイン
 * - リクエスト自身の Host とそのサブドメイン
 * - workers.dev 上なら、同じアカウントのサブドメイン（<worker>.<account>.workers.dev の
 *   <account>.workers.dev 配下）。同じアカウントの他の Worker も同居アプリとみなす
 * 返した各要素は「それ自体とその配下」を拒否する接尾辞として使う。
 */
export function ownHostSuffixes(hosts: Array<string | undefined>): string[] {
  const result = new Set<string>();
  for (const raw of hosts) {
    if (!raw) continue;
    let host = normalizeHostname(raw);
    if (!host) continue;
    if (host.startsWith("www.")) host = host.slice(4);
    if (host.endsWith(".workers.dev")) {
      const labels = host.split(".");
      // <worker>.<account>.workers.dev → <account>.workers.dev
      if (labels.length >= 4) host = labels.slice(-3).join(".");
    }
    result.add(host);
  }
  return [...result];
}

/** URL オブジェクト（正規化済み）のホストとポートを検査する。リダイレクト先にも使う */
export function checkUrl(url: URL, ownSuffixes: readonly string[]): UrlGuardResult {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "invalid_url" };
  }
  // ユーザー情報付き（http://user:pass@host/）は拒否する。上流に認証情報を送らないため、
  // また `http://allowed.com@evil/` のような見た目のごまかしを避けるため
  if (url.username !== "" || url.password !== "") {
    return { ok: false, error: "invalid_url" };
  }
  // 既定ポート（http:80 / https:443）はパーサが空文字にする。空以外はすべて拒否する
  // （https://host:80 や http://host:443 のような組み合わせも拒否）
  if (url.port !== "") {
    return { ok: false, error: "forbidden_host" };
  }

  const raw = url.hostname;
  // IPv6（[::1]、[::ffff:7f00:1] 等の IPv4-mapped を含む）
  if (raw.startsWith("[") || raw.includes(":")) {
    return { ok: false, error: "forbidden_host" };
  }
  // 末尾ドットは 1 つまで（`example.com..` は空ラベルとして下で弾く）
  const host = normalizeHostname(raw);
  if (host === "") return { ok: false, error: "forbidden_host" };

  const labels = host.split(".");
  // ドットの無い単一ラベル（http://intranet/ 等）は社内向けの名前とみなす
  if (labels.length < 2) return { ok: false, error: "forbidden_host" };
  if (!labels.every((label) => LABEL_RE.test(label))) {
    return { ok: false, error: "forbidden_host" };
  }
  // IPv4（パーサが 127.0.0.1 の形にしたもの）。最後のラベルが数値なら IP とみなす
  const last = labels[labels.length - 1] ?? "";
  if (NUMERIC_LABEL_RE.test(last)) return { ok: false, error: "forbidden_host" };

  if (BLOCKED_SUFFIXES.some((suffix) => matchesSuffix(host, suffix))) {
    return { ok: false, error: "forbidden_host" };
  }
  if (ownSuffixes.some((suffix) => matchesSuffix(host, suffix))) {
    return { ok: false, error: "forbidden_host" };
  }
  return { ok: true, url };
}

/** 利用者が入力した URL 文字列を検査する */
export function parseAndCheckUrl(
  input: string | undefined | null,
  ownSuffixes: readonly string[],
): UrlGuardResult {
  if (typeof input !== "string") return { ok: false, error: "invalid_url" };
  const trimmed = input.trim();
  if (trimmed === "" || trimmed.length > MAX_URL_LENGTH) {
    return { ok: false, error: "invalid_url" };
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, error: "invalid_url" };
  }
  return checkUrl(url, ownSuffixes);
}

/** リダイレクトの Location を現在の URL 基準で解決して検査する */
export function resolveRedirect(
  location: string | null,
  base: URL,
  ownSuffixes: readonly string[],
): UrlGuardResult {
  if (!location || location.length > MAX_URL_LENGTH) return { ok: false, error: "invalid_url" };
  let url: URL;
  try {
    url = new URL(location, base);
  } catch {
    return { ok: false, error: "invalid_url" };
  }
  return checkUrl(url, ownSuffixes);
}
