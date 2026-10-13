/**
 * CSP 等のセキュリティヘッダーを作る（docs/site-plan.md §6）。2 本立てにする。
 *
 * 1. ページごとの CSP は各 HTML の `<meta http-equiv="Content-Security-Policy">` に書く。
 *    プリレンダリングした HTML にはページごとに内容の違うインラインスクリプト（テーマの初期化・
 *    React Router のハイドレーション用データ・React のストリーミング用）があるので、ビルド後に
 *    ページごとの SHA-256 ハッシュを計算して入れる。JSON-LD（type="application/ld+json"）は
 *    データブロックで実行されないため、CSP の対象外（ハッシュ不要）
 * 2. meta では効かないディレクティブ（frame-ancestors 等）は、Workers の静的アセットの `_headers` の
 *    ワイルドカード 1 本で付ける。複数の CSP はすべて強制されるので、両方の制限が効く。
 *    ページが増えても `_headers` のルール数は増えない
 *
 * Node の型除去で直接実行する（scripts/postbuild.ts から）ので、node: 以外を import しない。
 */
import { createHash } from "node:crypto";

/** 実行されるスクリプトの type（これ以外の type はデータブロックとして CSP の対象外） */
const EXECUTABLE_TYPES = new Set(["", "text/javascript", "application/javascript", "module"]);

/** HTML 内のインラインスクリプト（src なし・実行されるもの）の中身を出現順に返す */
export function extractInlineScripts(html: string): string[] {
  const scripts: string[] = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  for (const m of html.matchAll(re)) {
    const attrs = m[1] ?? "";
    if (/\ssrc\s*=/i.test(` ${attrs}`)) continue;
    const type = /\btype\s*=\s*["']?([^"'\s>]+)/i.exec(attrs)?.[1]?.toLowerCase() ?? "";
    if (!EXECUTABLE_TYPES.has(type)) continue;
    scripts.push(m[2] ?? "");
  }
  return scripts;
}

/** CSP のハッシュ値（'sha256-...'）。ブラウザは要素の中身の文字列を UTF-8 でハッシュする */
export function cspHash(source: string): string {
  return `'sha256-${createHash("sha256").update(source, "utf8").digest("base64")}'`;
}

/** HTML のインラインスクリプトのハッシュ（重複を除いて出現順） */
export function inlineScriptHashes(html: string): string[] {
  return [...new Set(extractInlineScripts(html).map(cspHash))];
}

/**
 * 許可する外部ドメイン。AdSense は公式ドキュメント（「AdSense で CSP を使う」）のドメインを許可リストにする。
 * 広告を実際に出すフェーズ 11 で、コンソールの CSP 違反を見て調整する。
 */
const ADSENSE_SCRIPT = [
  "https://pagead2.googlesyndication.com",
  "https://*.googlesyndication.com",
  "https://*.g.doubleclick.net",
  "https://*.googleadservices.com",
  "https://adservice.google.com",
  "https://www.googletagservices.com",
  "https://*.adtrafficquality.google",
  // 同意管理（CMP。AdSense の「プライバシーとメッセージ」）
  "https://fundingchoicesmessages.google.com",
  "https://www.gstatic.com",
];
const ADSENSE_FRAME = [
  "https://*.googlesyndication.com",
  "https://*.g.doubleclick.net",
  "https://www.google.com",
  "https://*.adtrafficquality.google",
  "https://fundingchoicesmessages.google.com",
];
const ADSENSE_CONNECT = [
  "https://pagead2.googlesyndication.com",
  "https://*.googlesyndication.com",
  "https://*.g.doubleclick.net",
  "https://*.adtrafficquality.google",
  "https://csi.gstatic.com",
  "https://fundingchoicesmessages.google.com",
];
/** Cloudflare Web Analytics（ビーコンの読み込みと送信先） */
const CF_ANALYTICS_SCRIPT = ["https://static.cloudflareinsights.com"];
const CF_ANALYTICS_CONNECT = ["https://cloudflareinsights.com"];

/** meta の CSP では無効（無視される）ディレクティブ。これらは _headers で付ける */
export const META_INVALID_DIRECTIVES = ["frame-ancestors", "report-uri", "report-to", "sandbox"];

/** _headers のワイルドカードで全応答に付ける CSP（meta では効かないものと、基本の制限） */
export const HEADER_CSP = "frame-ancestors 'none'; object-src 'none'; base-uri 'self'";

/** ページ用の CSP（meta に入れる）。scriptHashes はそのページのインラインスクリプトのハッシュ */
export function buildCsp(scriptHashes: string[]): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // 'wasm-unsafe-eval'：WASM（jSquash 等）の実行に必要
    "script-src": [
      "'self'",
      "'wasm-unsafe-eval'",
      ...scriptHashes,
      ...ADSENSE_SCRIPT,
      ...CF_ANALYTICS_SCRIPT,
    ],
    // React の style 属性・Radix・広告が入れるインラインスタイルのため 'unsafe-inline'
    "style-src": ["'self'", "'unsafe-inline'"],
    // 広告の画像は配信元が多いので https: を許可。処理結果のプレビューは blob: / data:
    "img-src": ["'self'", "blob:", "data:", "https:"],
    "font-src": ["'self'", "data:"],
    // 'self'：/<アプリ>/api/ と WASM の取得。blob: / data:：処理結果を fetch で読む場合
    "connect-src": ["'self'", "blob:", "data:", ...ADSENSE_CONNECT, ...CF_ANALYTICS_CONNECT],
    "media-src": ["'self'", "blob:", "data:"],
    "frame-src": ADSENSE_FRAME,
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
  };
  for (const name of META_INVALID_DIRECTIVES) {
    if (name in directives)
      throw new Error(`${name} は meta の CSP では効きません（_headers に書く）`);
  }
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}

/** HTML の属性値として安全にする（CSP の値には & < > " は通常入らないが、念のため逃がす） */
function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const CSP_META_RE = /<meta\b[^>]*http-equiv\s*=\s*["']?content-security-policy/i;

/**
 * HTML の head の先頭に、そのページのインラインスクリプトのハッシュ入りの CSP の meta を入れる。
 * meta の CSP はそれより後の要素にだけ効くので、テーマ初期化等のスクリプトより前に置く。
 * ただし head の最初が `<meta charset>` なら、その直後に置く（文字コードの宣言は先頭 1024 バイト以内に
 * 無ければならず、長い CSP を前に置くとはみ出す。charset の meta は CSP の影響を受けない）。
 * meta を足すだけでスクリプトの中身は変えない（念のため前後でハッシュが同じことを確かめる）。
 */
export function injectCspMeta(html: string): string {
  if (CSP_META_RE.test(html)) throw new Error("CSP の meta が既にあります");
  const head = /<head\b[^>]*>/i.exec(html);
  if (!head) throw new Error("<head> がありません");
  const hashes = inlineScriptHashes(html);
  const meta = `<meta http-equiv="Content-Security-Policy" content="${escapeAttribute(buildCsp(hashes))}"/>`;
  let at = head.index + head[0].length;
  const charset = /^<meta\s+charset\s*=\s*["']?[\w-]+["']?\s*\/?>/i.exec(html.slice(at));
  if (charset) at += charset[0].length;
  const result = html.slice(0, at) + meta + html.slice(at);
  const after = inlineScriptHashes(result);
  if (after.length !== hashes.length || after.some((hash, i) => hash !== hashes[i])) {
    throw new Error("CSP の meta を入れたらインラインスクリプトが変わりました");
  }
  return result;
}

/** Workers の _headers の制限（ルール数・1 行の長さ） */
export const HEADERS_MAX_RULES = 100;
export const HEADERS_MAX_LINE = 2000;

export interface HeaderRule {
  path: string;
  headers: string[];
}

/**
 * _headers の中身を作る。ルール数はページ数に依存しない。
 * - basePath 以下すべて：meta では効かない CSP（HEADER_CSP）と他のセキュリティヘッダー。
 *   同じヘッダーを複数ルールで付けると値が連結されるので、CSP はこのワイルドカードにだけ書く
 * - ハッシュ付きのアセット：長期キャッシュ
 * - extraRules：アプリが足すルール（Service Worker の sw.js の扱いなど）
 */
export function buildHeadersFile(basePath: string, extraRules: HeaderRule[] = []): string {
  const rules: HeaderRule[] = [
    {
      path: `${basePath}/*`,
      headers: [
        `Content-Security-Policy: ${HEADER_CSP}`,
        "X-Content-Type-Options: nosniff",
        "Referrer-Policy: strict-origin-when-cross-origin",
        "X-Frame-Options: DENY",
      ],
    },
    {
      path: `${basePath}/assets/*`,
      headers: ["Cache-Control: public, max-age=31536000, immutable"],
    },
    ...extraRules,
  ];
  if (rules.some((rule) => rule.path !== `${basePath}/*` && rule.headers.some(isCspHeader))) {
    throw new Error("CSP はワイルドカードのルールにだけ書きます（値が連結されるため）");
  }
  if (rules.length > HEADERS_MAX_RULES) {
    throw new Error(
      `_headers のルールが ${rules.length} 件あり、上限 ${HEADERS_MAX_RULES} を超えます`,
    );
  }
  const lines = rules.flatMap((rule) => [rule.path, ...rule.headers.map((h) => `  ${h}`), ""]);
  const tooLong = lines.find((line) => line.length > HEADERS_MAX_LINE);
  if (tooLong) {
    throw new Error(`_headers の行が ${HEADERS_MAX_LINE} 文字を超えます: ${tooLong.slice(0, 80)}…`);
  }
  return lines.join("\n");
}

function isCspHeader(header: string): boolean {
  return /^content-security-policy\s*:/i.test(header);
}
