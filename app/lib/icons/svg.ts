import { iconContentRect } from "./layout";

/**
 * SVG の元画像まわり（文字列処理だけ。DOM に挿入しない §3.6）。
 */

export function isSvgFile(file: { name: string; type: string }): boolean {
  return file.type === "image/svg+xml" || /\.svg$/i.test(file.name);
}

/** 単位なし・px の長さを数値にする。%・em 等は null */
function parseLength(value: string | undefined): number | null {
  if (!value) return null;
  const m = /^\s*([0-9]*\.?[0-9]+)\s*(px)?\s*$/i.exec(value);
  if (!m) return null;
  const n = Number(m[1]);
  return n > 0 ? n : null;
}

function readAttr(tag: string, name: string): string | undefined {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i").exec(tag);
  return m ? (m[1] ?? m[2]) : undefined;
}

/**
 * ルートの <svg> の width / height / viewBox から縦横比の元になるサイズを得る。
 * 分からなければ null（呼び出し側で正方形とみなす）。
 */
export function svgIntrinsicSize(text: string): { width: number; height: number } | null {
  const tag = /<svg\b[^>]*>/i.exec(text)?.[0];
  if (!tag) return null;
  const width = parseLength(readAttr(tag, "width"));
  const height = parseLength(readAttr(tag, "height"));
  if (width && height) return { width, height };

  const viewBox = readAttr(tag, "viewBox")
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  if (viewBox && viewBox.length === 4) {
    const vw = viewBox[2] as number;
    const vh = viewBox[3] as number;
    if (vw > 0 && vh > 0) {
      // 片方だけ指定されているときは viewBox の比率で補う
      if (width) return { width, height: (width * vh) / vw };
      if (height) return { width: (height * vw) / vh, height };
      return { width: vw, height: vh };
    }
  }
  return null;
}

/**
 * ルートの <svg> に width / height（px）を付けた文字列を返す。
 * width / height の無い SVG は、ブラウザによって（Firefox 等）canvas に描けないため、描画用にだけ使う。
 * 既に px で両方あるときはそのまま返す。
 */
export function withIntrinsicSize(text: string, size: { width: number; height: number }): string {
  const match = /<svg\b[^>]*>/i.exec(text);
  if (!match) return text;
  const tag = match[0];
  if (parseLength(readAttr(tag, "width")) && parseLength(readAttr(tag, "height"))) return text;
  const stripped = tag.replace(/\s(?:width|height)\s*=\s*(?:"[^"]*"|'[^']*')/gi, "");
  const sized = stripped.replace(/^<svg\b/i, `<svg width="${size.width}" height="${size.height}"`);
  return text.slice(0, match.index) + sized + text.slice(match.index + tag.length);
}

/**
 * favicon.svg 用に SVGO で軽く最適化する（既定のプリセット。SVGO 4 の既定は viewBox を残す）。
 * 失敗したら元の文字列を返す。SVGO は使うときに動的 import する。
 */
export async function optimizeFaviconSvg(text: string): Promise<string> {
  try {
    const { optimize } = await import("svgo/browser");
    const result = optimize(text, {
      multipass: false,
      plugins: ["preset-default"],
    });
    return result.data;
  } catch {
    return text;
  }
}

/** 包む SVG の座標系の一辺（viewBox は 0 0 N N の正方形） */
export const FAVICON_SVG_SIZE = 512;

/** 包む側の id の接頭辞（元の SVG の id とぶつからないようにする） */
export const FAVICON_SVG_ID_PREFIX = "ia-icon-";

const round = (n: number): number => Math.round(n * 1000) / 1000;

/** 色は #rrggbb だけを通す（属性値に入れるので念のため） */
function safeColor(value: string | null): string | null {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : null;
}

/** UTF-8 の文字列を base64 にする（日本語・絵文字も壊さない） */
export function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/**
 * 元の SVG を、余白・背景色・角丸を反映した正方形の SVG で包む（純粋な文字列処理。DOM には触れない）。
 * - 外側は viewBox が正方形。背景色があれば rect（rx / ry に角丸）を置く
 * - 元の SVG は <image> に data: URL（base64）で埋め込む。<style>・id・DOCTYPE が外側と混ざらず、
 *   描き方も PNG 版（画像として canvas に描く）と同じになる
 * - 配置とアスペクト比は size（PNG 描画と同じ source.width / height）で決め、余白の分だけ縮めて中央に置く
 * - 角丸があれば clipPath でも切り抜く（PNG 版 render.ts の見た目にそろえる）
 * 元の SVG が読めないとき（<svg> が無い）は元の文字列を返す。
 */
export function wrapFaviconSvg(
  svgText: string,
  settings: { padding: number; background: string | null; radius: number },
  size: { width: number; height: number },
): string {
  if (!/<svg\b/i.test(svgText)) return svgText;

  const S = FAVICON_SVG_SIZE;
  const rect = iconContentRect(S, settings.padding, size.width, size.height);

  // Firefox は width / height の無い SVG を画像として描けないので、PNG 版と同じく px を付ける
  const embedded = withIntrinsicSize(svgText, size);
  const href = `data:image/svg+xml;base64,${utf8ToBase64(embedded)}`;
  const image =
    `<image x="${round(rect.x)}" y="${round(rect.y)}" width="${round(rect.width)}" ` +
    `height="${round(rect.height)}" preserveAspectRatio="xMidYMid meet" href="${href}" xlink:href="${href}"/>`;

  const radius = Math.min(Math.max(settings.radius, 0), 0.5) * S;
  const color = safeColor(settings.background);
  const clipId = `${FAVICON_SVG_ID_PREFIX}clip`;
  const rounded = radius > 0;
  const rx = rounded ? ` rx="${round(radius)}" ry="${round(radius)}"` : "";

  const parts: string[] = [];
  if (rounded) {
    parts.push(
      `<defs><clipPath id="${clipId}"><rect width="${S}" height="${S}"${rx}/></clipPath></defs>`,
    );
  }
  const body: string[] = [];
  if (color) body.push(`<rect width="${S}" height="${S}"${rx} fill="${color}"/>`);
  body.push(image);
  parts.push(rounded ? `<g clip-path="url(#${clipId})">${body.join("")}</g>` : body.join(""));

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `viewBox="0 0 ${S} ${S}" width="${S}" height="${S}">${parts.join("")}</svg>`
  );
}
