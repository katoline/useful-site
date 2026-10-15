/** QR 生成の設定型・定数。DOM に依存しない（値をそのまま持ち、判定はしない）。 */

/** 誤り訂正レベル。読み取り品質を優先して常に H を使う。 */
export const QR_ERROR_CORRECTION_LEVEL = "H" as const;

/** 必ず確保する余白（モジュール数）。仕様の「4 モジュール」 */
export const QR_QUIET_ZONE_MODULES = 4;

/** URL の UTF-8 バイト数の上限 */
export const MAX_URL_BYTES = 1000;

/** PNG の出力サイズ（px）。小さいほど 1 モジュールあたりの画素が減る */
export const PNG_SIZES = [256, 512, 1024, 2048] as const;
export type PngSize = (typeof PNG_SIZES)[number];

/** PNG の既定サイズ */
export const DEFAULT_PNG_SIZE: PngSize = 512;

/** 中央アイコンの大きさ（QR 本体の幅に対する百分率） */
export const ICON_SIZE_PERCENT_MIN = 12;
export const ICON_SIZE_PERCENT_MAX = 20;
export const ICON_SIZE_PERCENT_DEFAULT = 16;

/** アイコンの周りに必ず付ける白い台座の幅（モジュール数） */
export const ICON_PADDING_MODULES = 1;

/**
 * 読み取りに必要なおおよその最小解像度（1 モジュールあたりの画素数）。
 * これより粗い PNG は保存させない。
 */
export const MIN_PIXELS_PER_MODULE = 4;

/** 白背景に対するコントラスト比の下限（WCAG の AAA 相当） */
export const MIN_COLOR_CONTRAST = 7;

/** 背景色。白で固定する（シンボルは常に白背景に描く） */
export const QR_BACKGROUND_COLOR = "#ffffff";

/** 前景色のプリセット。すべて白背景に対して {@link MIN_COLOR_CONTRAST} 以上 */
export const QR_FOREGROUND_PRESETS = [
  { id: "black", color: "#000000" },
  { id: "slate", color: "#0f172a" },
  { id: "navy", color: "#1e3a8a" },
  { id: "green", color: "#14532d" },
  { id: "red", color: "#7f1d1d" },
  { id: "violet", color: "#4c1d95" },
  { id: "brown", color: "#78350f" },
] as const;

export type ForegroundPresetId = (typeof QR_FOREGROUND_PRESETS)[number]["id"];

/** 前景色の既定値 */
export const DEFAULT_FOREGROUND_COLOR = "#000000";

/** 中央アイコンの PNG data URL の長さの上限（base64 文字数。512px PNG は余裕で収まる） */
export const MAX_ICON_DATA_URL_LENGTH = 4_000_000;

/** SVG の表示に使う基準の一辺（px。viewBox で拡大縮小する） */
export const SVG_INTRINSIC_SIZE = 1024;

/** QR 生成の設定 */
export interface QrSettings {
  /** 前景色（`#rrggbb` の小文字） */
  foreground: string;
  /** PNG の出力サイズ（px） */
  pngSize: PngSize;
  /** 中央アイコンの大きさ（QR 本体の幅に対する百分率） */
  iconSizePercent: number;
}

/** 設定の既定値 */
export const DEFAULT_QR_SETTINGS: QrSettings = {
  foreground: DEFAULT_FOREGROUND_COLOR,
  pngSize: DEFAULT_PNG_SIZE,
  iconSizePercent: ICON_SIZE_PERCENT_DEFAULT,
};
