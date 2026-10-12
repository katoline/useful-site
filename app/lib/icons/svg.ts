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
