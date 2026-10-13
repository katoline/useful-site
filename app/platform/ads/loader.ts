/**
 * AdSense のスクリプト（adsbygoogle.js）の読み込み。1 ページ（1 回の文書の読み込み）につき 1 回だけ入れる。
 * クライアント側遷移では文書が変わらないので、モジュールの状態で重複を防ぐ。
 * インラインスクリプトは使わない（CSP はハッシュ方式。scripts/lib/csp.ts の許可リストで外部スクリプトを許す）。
 */

const SCRIPT_BASE = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/** スクリプトの URL（client はクエリに入れる） */
export function adSenseScriptUrl(client: string): string {
  return `${SCRIPT_BASE}?client=${encodeURIComponent(client)}`;
}

let loading: Promise<void> | null = null;
let markReady: () => void = () => {};
let ready: Promise<void> = createReady();

function createReady(): Promise<void> {
  return new Promise<void>((resolve) => {
    markReady = resolve;
  });
}

/**
 * スクリプトの読み込みが終わったら解決する。読み込みに失敗した（広告ブロック等）ときは解決しない
 * （広告枠は push しないまま、確保した高さの枠だけが残る）
 */
export function whenAdSenseReady(): Promise<void> {
  return ready;
}

/** 失敗したスクリプト要素（次の呼び出しで取り除いて入れ直す） */
let failedScript: HTMLScriptElement | null = null;

/**
 * スクリプトを 1 回だけ入れる。読み込み中・成功後は同じ Promise を返す。
 * 失敗したとき（回線の切断等）は、次の呼び出し（オンラインに戻ったとき）で古い要素を外して入れ直す
 */
export function loadAdSenseScript(client: string, doc: Document = document): Promise<void> {
  if (loading && !failedScript) return loading;
  failedScript?.remove();
  failedScript = null;
  loading = new Promise<void>((resolve, reject) => {
    const script = doc.createElement("script");
    script.async = true;
    script.src = adSenseScriptUrl(client);
    script.crossOrigin = "anonymous";
    script.addEventListener("load", () => {
      if (failedScript === script) failedScript = null;
      markReady();
      resolve();
    });
    script.addEventListener("error", () => {
      failedScript = script;
      reject(new Error("AdSense のスクリプトを読めません"));
    });
    doc.head.appendChild(script);
  });
  // 失敗はページを壊さない（呼び出し側で待たなくても未処理の拒否にしない）
  loading.catch(() => {});
  return loading;
}

/**
 * 表示が落ち着いてから cb を呼ぶ。requestIdleCallback があればそれで、無ければ load 後の setTimeout で。
 * 戻り値で取り消せる
 */
export function scheduleWhenIdle(cb: () => void, win: Window = window): () => void {
  if (typeof win.requestIdleCallback === "function") {
    const id = win.requestIdleCallback(cb, { timeout: 5000 });
    return () => win.cancelIdleCallback(id);
  }
  let timer: number | undefined;
  const run = () => {
    timer = win.setTimeout(cb, 1000);
  };
  if (win.document.readyState === "complete") run();
  else win.addEventListener("load", run, { once: true });
  return () => {
    win.removeEventListener("load", run);
    if (timer !== undefined) win.clearTimeout(timer);
  };
}

/** 押し込み済みの <ins>（1 つの <ins> に 2 回 push しない。StrictMode の 2 回目の effect・再描画を含む） */
const pushed = new WeakSet<Element>();

/** <ins class="adsbygoogle"> を 1 回だけ埋める。押し込んだら true */
export function pushAd(ins: Element, win: Window = window): boolean {
  if (pushed.has(ins) || ins.hasAttribute("data-adsbygoogle-status")) return false;
  pushed.add(ins);
  try {
    win.adsbygoogle = win.adsbygoogle ?? [];
    win.adsbygoogle.push({});
  } catch {
    // 広告の失敗でページを壊さない
  }
  return true;
}

/** 単体テスト用：読み込みの状態を戻す */
export function resetAdSenseLoaderForTest(): void {
  loading = null;
  failedScript = null;
  ready = createReady();
}
