/**
 * CSP 等のセキュリティヘッダー（plan.md §7.4）を、Workers の静的アセットの `_headers` として作る。
 *
 * プリレンダリングした HTML にはページごとに内容の違うインラインスクリプト（テーマの初期化・
 * React Router のハイドレーション用データ・React のストリーミング用）があるので、ビルド後に
 * ページごとの SHA-256 ハッシュを計算し、ページの URL ごとに CSP を書く。
 * JSON-LD（type="application/ld+json"）はデータブロックで実行されないため、CSP の対象外（ハッシュ不要）。
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

/** ページ用の CSP。scriptHashes はそのページのインラインスクリプトのハッシュ */
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
    // 'self'：/image-adjust/api/ と WASM の取得。blob: / data:：処理結果を fetch で読む場合
    "connect-src": ["'self'", "blob:", "data:", ...ADSENSE_CONNECT, ...CF_ANALYTICS_CONNECT],
    "media-src": ["'self'", "blob:", "data:"],
    "frame-src": ADSENSE_FRAME,
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    // クリックジャッキング対策
    "frame-ancestors": ["'none'"],
  };
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}

export interface PageHtml {
  /** 配信 URL のパス（例 "/image-adjust/about/"） */
  urlPath: string;
  html: string;
}

/** Workers の _headers の制限（ルール数・1 行の長さ） */
export const HEADERS_MAX_RULES = 100;
export const HEADERS_MAX_LINE = 2000;

/**
 * _headers の中身を作る。
 * - basePath 以下すべて：CSP 以外のセキュリティヘッダー
 * - 各ページ：そのページのハッシュ入りの CSP（同じヘッダーを複数ルールで付けると値が連結されるので、
 *   CSP はページの URL ごとの完全一致ルールにだけ書く）
 * - ハッシュ付きのアセット：長期キャッシュ。sw.js：毎回確認
 */
export function buildHeadersFile(basePath: string, pages: PageHtml[]): string {
  const rules: { path: string; headers: string[] }[] = [
    {
      path: `${basePath}/*`,
      headers: [
        "X-Content-Type-Options: nosniff",
        "Referrer-Policy: strict-origin-when-cross-origin",
        "X-Frame-Options: DENY",
      ],
    },
    {
      path: `${basePath}/assets/*`,
      headers: ["Cache-Control: public, max-age=31536000, immutable"],
    },
    { path: `${basePath}/sw.js`, headers: ["Cache-Control: no-cache"] },
    ...[...pages]
      .sort((a, b) => a.urlPath.localeCompare(b.urlPath))
      .map((page) => ({
        path: page.urlPath,
        headers: [`Content-Security-Policy: ${buildCsp(inlineScriptHashes(page.html))}`],
      })),
  ];
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
