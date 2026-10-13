/** 用紙・向き・余白・文字サイズ・書体・改ページの定義（何にも依存しない） */

export const PAPER_SIZES = ["a4", "letter"] as const;
export type PaperSize = (typeof PAPER_SIZES)[number];

/** 用紙の大きさ（縦向きの幅×高さ、mm） */
export const PAPER_DIMENSIONS_MM: Record<PaperSize, { width: number; height: number }> = {
  a4: { width: 210, height: 297 },
  letter: { width: 215.9, height: 279.4 },
};

export const ORIENTATIONS = ["portrait", "landscape"] as const;
export type Orientation = (typeof ORIENTATIONS)[number];

export const MARGINS = ["narrow", "normal", "wide"] as const;
export type Margin = (typeof MARGINS)[number];
/** 余白（上下左右、mm） */
export const MARGIN_MM: Record<Margin, number> = { narrow: 10, normal: 20, wide: 30 };

/** 本文の文字サイズ（pt） */
export const FONT_SIZES = [9, 10, 11, 12, 14] as const;
export type FontSize = (typeof FONT_SIZES)[number];

export const FONT_FAMILIES = ["gothic", "mincho"] as const;
export type FontFamily = (typeof FONT_FAMILIES)[number];

export interface DocumentSettings {
  paper: PaperSize;
  orientation: Orientation;
  margin: Margin;
  fontSize: FontSize;
  fontFamily: FontFamily;
  /** `---`（水平線）で改ページする */
  pageBreakOnRule: boolean;
}

export const DEFAULT_SETTINGS: DocumentSettings = {
  paper: "a4",
  orientation: "portrait",
  margin: "normal",
  fontSize: 11,
  fontFamily: "gothic",
  pageBreakOnRule: true,
};

/** 向きを反映した用紙の大きさ（mm） */
export function pageDimensions(paper: PaperSize, orientation: Orientation) {
  const { width, height } = PAPER_DIMENSIONS_MM[paper];
  return orientation === "portrait" ? { width, height } : { width: height, height: width };
}
