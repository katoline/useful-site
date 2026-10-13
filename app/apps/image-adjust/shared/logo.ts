/**
 * サイトのロゴ（マーク）の図形。ヘッダーのインライン SVG（shared/layout/LogoMark.tsx）と、
 * public/logo.svg・アイコン・OGP 画像の生成（scripts/generate-icons.ts・generate-og-images.ts。app/apps/image-adjust/scripts/）が
 * 同じ図形を使うよう、ここだけで定義する。
 * Node で直接実行するスクリプトからも読むので、他のモジュールを import しない。
 *
 * 形：角丸の正方形の面（タイル）に、写真の「山と太陽」と、その下の調整スライダー（つまみ付きの線）を
 * 抜いた形。32 の格子で設計し、16px（1 単位 = 0.5px）でも線が画素の境界にそろうよう、
 * スライダーの線は偶数の座標に置いている。
 */

/** 座標系の一辺（viewBox は 0 0 LOGO_SIZE LOGO_SIZE） */
export const LOGO_SIZE = 32;

/** タイルの角丸の半径（座標系の単位） */
export const LOGO_TILE_RADIUS = 7;

/** タイルの角丸の半径の、一辺に対する割合（アイコン生成の角丸の設定に使う） */
export const LOGO_TILE_RADIUS_RATIO = LOGO_TILE_RADIUS / LOGO_SIZE;

/** 円を時計回りの 2 つの弧で描く（他の図形と同じ向きにして、重なっても穴にならないようにする） */
const circle = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 1 ${r * 2} 0a${r} ${r} 0 1 1 ${-r * 2} 0z`;

/**
 * タイルの上に置く記号（1 本のパス。すべて時計回り）。
 * - 太陽：右上の円
 * - 山：2 つの峰
 * - スライダー：下の横線とつまみ
 */
export const LOGO_GLYPH_PATH = [
  circle(23, 7, 3),
  "M4 18L12 8L17 13L19 11L28 18Z",
  "M5 22H27a1 1 0 0 1 0 2H5a1 1 0 0 1 0-2Z",
  circle(11, 23, 3.5),
].join("");

/** 色を指定して、マーク単体の SVG 文字列を作る（public/logo.svg・OGP 画像用） */
export function buildLogoSvg(
  options: { tile?: string; glyph?: string; title?: string } = {},
): string {
  const { tile = "#0a0a0a", glyph = "#ffffff", title } = options;
  const s = LOGO_SIZE;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}" width="${s}" height="${s}">`,
    ...(title ? [`  <title>${title}</title>`] : []),
    `  <rect width="${s}" height="${s}" rx="${LOGO_TILE_RADIUS}" fill="${tile}"/>`,
    `  <path fill="${glyph}" d="${LOGO_GLYPH_PATH}"/>`,
    "</svg>",
    "",
  ].join("\n");
}
