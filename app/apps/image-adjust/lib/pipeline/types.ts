/**
 * 変換・圧縮パイプラインの共通インターフェース（§3.2 最後）。
 * UI はこの型だけを見る。処理の実体（Web Worker / メインスレッド / 将来のサーバー）は
 * ImageProcessor の実装で差し替える。
 */
import type { ImageFormat, RasterFormat } from "../codecs/format";
import type { SvgLevel } from "../codecs/svg";

/** 出力形式。"same" は入力と同じ形式で圧縮する */
export type OutputFormat = "same" | RasterFormat;

/** サイズの決め方（§2.2） */
export type SizeMode = "quality" | "target";

export interface ResizeSettings {
  mode: "none" | "px" | "percent";
  /** px 指定の幅・高さ。片方だけならアスペクト比から補う */
  width: number | null;
  height: number | null;
  /** % 指定（1〜100） */
  percent: number;
  /** 幅・高さの両方を指定したときにアスペクト比を保つ（はみ出さない大きさに収める） */
  keepAspect: boolean;
  /** 元より大きくしない（既定オン。拡大は画質を落とすだけ） */
  noEnlarge: boolean;
}

export interface GifSettings {
  level: 1 | 2 | 3;
  lossy: number;
  colors: number | null;
}

export interface ProcessSettings {
  output: OutputFormat;
  sizeMode: SizeMode;
  /** 0〜100。JPEG / WebP の品質。PNG は色数（quality → 2〜256 色）に対応づける */
  quality: number;
  /** 目標ファイルサイズ（バイト）。sizeMode が "target" のときに使う */
  targetBytes: number;
  resize: ResizeSettings;
  /** 透過画像を JPEG にするときの背景色（#rrggbb） */
  jpegBackground: string;
  jpegProgressive: boolean;
  /** true なら PNG を減色しない（可逆）。false なら quality を色数（2〜256）に対応づけて減色する */
  pngLossless: boolean;
  webpLossless: boolean;
  gif: GifSettings;
  svgLevel: SvgLevel;
  /** EXIF 等のメタデータを削除する（既定オン。§2.5） */
  stripMetadata: boolean;
  /** レスポンシブ用の複数幅。空なら 1 枚だけ出す */
  responsiveWidths: number[];
}

export const DEFAULT_SETTINGS: ProcessSettings = {
  output: "same",
  sizeMode: "quality",
  quality: 80,
  targetBytes: 200 * 1024,
  resize: {
    mode: "none",
    width: null,
    height: null,
    percent: 50,
    keepAspect: true,
    noEnlarge: true,
  },
  jpegBackground: "#ffffff",
  jpegProgressive: true,
  pngLossless: false,
  webpLossless: false,
  gif: { level: 2, lossy: 30, colors: null },
  svgLevel: "standard",
  stripMetadata: true,
  responsiveWidths: [],
};

/** 品質プリセット（§2.2）：高画質 / 標準 / 軽量 */
export const QUALITY_PRESETS = { high: 90, standard: 80, light: 60 } as const;
export type QualityPreset = keyof typeof QUALITY_PRESETS;

export interface ProcessInput {
  id: string;
  /** 表示・保存用のファイル名 */
  name: string;
  /** ZIP 内の相対パス（フォルダ構成の維持用）。単体ファイルなら name と同じ */
  path: string;
  bytes: ArrayBuffer;
  /** File.type（判定の補助にだけ使う） */
  type?: string;
}

export type ProcessWarning =
  /** 目標サイズに届かず、最小品質の結果を出した */
  | "target_unreachable"
  /** 再エンコードのためメタデータは保持できなかった（stripMetadata が false のとき） */
  | "metadata_dropped"
  /** GIF は形式変換の対象外なので GIF のまま最適化した */
  | "gif_kept"
  /** SVG は形式変換・リサイズの対象外なので SVG のまま最適化した */
  | "svg_kept"
  /** 元より大きくなったので元のデータをそのまま出した */
  | "kept_original"
  /** アニメーション WebP は対象外なので元のまま返した */
  | "animated_webp";

export interface ProcessOutput {
  name: string;
  path: string;
  format: ImageFormat;
  bytes: ArrayBuffer;
  width: number | null;
  height: number | null;
  /** 採用した品質（0〜100）。探索しなかったときは null */
  quality: number | null;
  /** レスポンシブ書き出しの幅（通常出力は null） */
  variantWidth: number | null;
}

export interface ProcessResult {
  id: string;
  inputFormat: ImageFormat;
  inputBytes: number;
  inputWidth: number | null;
  inputHeight: number | null;
  outputs: ProcessOutput[];
  warnings: ProcessWarning[];
}

export type ProcessErrorCode =
  | "unsupported"
  | "too_many_pixels"
  | "decode_failed"
  | "encode_failed";

export class ProcessError extends Error {
  readonly code: ProcessErrorCode;
  constructor(code: ProcessErrorCode, message?: string) {
    super(message ?? code);
    this.name = "ProcessError";
    this.code = code;
  }
}

/** 画像 1 件を処理する入口。実装は Worker プール（既定）か、同じスレッド */
export interface ImageProcessor {
  process(input: ProcessInput, settings: ProcessSettings): Promise<ProcessResult>;
  /** まだ始まっていない処理を取り消す（進行中のものは完了を待つ） */
  cancelPending(): void;
  dispose(): void;
}
