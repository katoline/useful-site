/**
 * 信頼済みの図形データから、固定の SVG 文字列を組み立てる純粋な処理。
 * ここへ入る値は feature 内の定数（Lucide 相当のパス・Simple Icons のパス）だけで、ユーザーの文字列は混ぜない。
 */
import type { IconArtwork } from "../../../domain/icons";

/** 組込アイコンの viewBox（Lucide・Simple Icons とも 24×24） */
export const ICON_VIEW_BOX = "0 0 24 24";

/** 図形 1 つ。数値と信頼済みのパス文字列だけで表す */
export type IconShape =
  | { readonly type: "path"; readonly d: string }
  | { readonly type: "circle"; readonly cx: number; readonly cy: number; readonly r: number }
  | {
      readonly type: "rect";
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
      readonly rx?: number;
    };

/** stroke は Lucide の線画、solid は Simple Icons の塗りつぶし */
export type IconRender = "stroke" | "solid";

export interface IconDefinition {
  readonly render: IconRender;
  readonly shapes: readonly IconShape[];
}

/** 図形 1 つ分の固定マークアップ */
export function shapeMarkup(shape: IconShape): string {
  switch (shape.type) {
    case "path":
      return `<path d="${shape.d}"/>`;
    case "circle":
      return `<circle cx="${shape.cx}" cy="${shape.cy}" r="${shape.r}"/>`;
    case "rect": {
      const rx = shape.rx === undefined ? "" : ` rx="${shape.rx}"`;
      return `<rect x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}"${rx}/>`;
    }
  }
}

/** React の key 用（図形の中身から作る。配列の添字を使わない） */
export function shapeKey(shape: IconShape): string {
  switch (shape.type) {
    case "path":
      return `path:${shape.d}`;
    case "circle":
      return `circle:${shape.cx},${shape.cy},${shape.r}`;
    case "rect":
      return `rect:${shape.x},${shape.y},${shape.width},${shape.height},${shape.rx ?? ""}`;
  }
}

/**
 * 生成エンジンは外側の `<svg>` を捨てて中身（inner）だけを入れ子の `<svg fill="{foreground}">` へ組み直す。
 * そのため描画属性は外側に置かず、中の `<g>` に持たせる。
 * - 塗りつぶし（ブランド）: 属性を付けず、入れ子 svg の fill（QR の前景色）を継承させる。
 * - 線画（汎用）: 入れ子 svg は fill しか付けないので、線の指定と色を内側の g に固定する
 *   （stroke は fill を継承しない。エンジンは color を渡さないため、内側で固定の黒にする）。
 */
const STROKE_INNER_ATTRS =
  'fill="none" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

/** 外側の `<svg>` を外しても残る、アイコンの中身（生成エンジンが取り出す部分） */
export function iconInner(definition: IconDefinition): string {
  const shapes = definition.shapes.map(shapeMarkup).join("");
  return definition.render === "solid"
    ? `<g>${shapes}</g>`
    : `<g ${STROKE_INNER_ATTRS}>${shapes}</g>`;
}

/**
 * 外側の `<svg>` を含む固定の SVG 文字列。カラーは中身が決める（汎用は黒、ブランドは親の fill を継承）。
 * 単体で `<img src="data:...">` としても線画が消えないよう、内側の `<g>` に属性を持たせている。
 */
export function iconSvg(definition: IconDefinition): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${ICON_VIEW_BOX}">${iconInner(definition)}</svg>`;
}

export function iconSvgArtwork(definition: IconDefinition): IconArtwork {
  return { kind: "svg", svg: iconSvg(definition) };
}
