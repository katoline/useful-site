/**
 * リンク・画像の URL の規則（docs/markdown-pdf-plan.md §3「画像」・§5）。
 *
 * - リンク：許可リスト。スキームなし（相対パス・#・?）と http(s):・mailto:・tel:、画像の data: だけ
 * - 画像：data: の画像と、一緒に入れた画像ファイル（相対パス → blob: の URL）だけを表示する。
 *   外部 URL（http(s): やプロトコル相対 //）は読み込まない（外部へ送信しない）
 */

/** img 要素で表示する data: の画像の種類 */
const DATA_IMAGE_RE = /^data:image\/(?:png|jpeg|gif|webp|avif|svg\+xml)[;,]/;
const SCHEME_RE = /^([a-z][a-z0-9+.-]*):/;
const ALLOWED_LINK_SCHEMES = new Set(["http", "https", "mailto", "tel"]);

/**
 * ブラウザは URL のスキームを読むときにタブ・改行を取り除き、前後の制御文字・空白も無視する。
 * 判定も同じ形にそろえてから行う（`java\tscript:` 等をすり抜けさせない）
 */
function canonical(url: string): string {
  const stripped = url.replace(/[\t\n\r]/g, "");
  let start = 0;
  let end = stripped.length;
  while (start < end && stripped.charCodeAt(start) <= 0x20) start++;
  while (end > start && stripped.charCodeAt(end - 1) <= 0x20) end--;
  return stripped.slice(start, end);
}

/** スキーム（小文字）。無ければ undefined（相対パス・# 等） */
export function urlScheme(url: string): string | undefined {
  return SCHEME_RE.exec(canonical(url).toLowerCase())?.[1];
}

export function isDataImageUrl(url: string): boolean {
  return DATA_IMAGE_RE.test(canonical(url).toLowerCase());
}

/** リンク・画像の URL として受け付けるか（markdown-it の validateLink に使う） */
export function isAllowedUrl(url: string): boolean {
  const scheme = urlScheme(url);
  if (scheme === undefined) return true;
  if (scheme === "data") return isDataImageUrl(url);
  return ALLOWED_LINK_SCHEMES.has(scheme);
}

/** ページ内の移動（#…）か */
export function isFragmentLink(url: string): boolean {
  return canonical(url).startsWith("#");
}

export type ImageResolution =
  | { kind: "ok"; src: string }
  | { kind: "blocked"; reason: "external" | "missing" | "unsafe" };

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** 相対パスを比べやすい形にする（`./a/../img/x.png?v=1` → `img/x.png`） */
export function normalizeImagePath(src: string): string {
  const path = safeDecode(canonical(src).replace(/[?#].*$/, "")).replace(/\\/g, "/");
  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}

function baseName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/**
 * 画像の参照を表示に使う URL に置き換える。
 * images のキーは一緒に入れた画像のファイル名（フォルダごと入れたときは相対パス）。
 * 一致の順：正規化した相対パス → ファイル名 → ファイル名（大文字小文字を無視）
 */
export function resolveImageSource(
  src: string,
  images: ReadonlyMap<string, string>,
): ImageResolution {
  const scheme = urlScheme(src);
  if (scheme === "data") {
    return isDataImageUrl(src)
      ? { kind: "ok", src: canonical(src) }
      : { kind: "blocked", reason: "unsafe" };
  }
  if (scheme !== undefined) {
    return {
      kind: "blocked",
      reason: scheme === "http" || scheme === "https" ? "external" : "unsafe",
    };
  }
  // プロトコル相対（//example.com/x.png）は外部
  if (/^[\\/]{2}/.test(canonical(src))) return { kind: "blocked", reason: "external" };
  const path = normalizeImagePath(src);
  if (!path) return { kind: "blocked", reason: "missing" };
  const normalized = new Map<string, string>();
  for (const [key, url] of images) normalized.set(normalizeImagePath(key), url);
  const name = baseName(path);
  const found =
    normalized.get(path) ??
    [...normalized].find(([key]) => baseName(key) === name)?.[1] ??
    [...normalized].find(([key]) => baseName(key).toLowerCase() === name.toLowerCase())?.[1];
  return found ? { kind: "ok", src: found } : { kind: "blocked", reason: "missing" };
}
