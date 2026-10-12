/**
 * 変換・圧縮ツールの画面状態（ToolSessionProvider に置く）。
 * パイプラインの ArrayBuffer は Blob に包んで持つ（大きなデータをブラウザに任せる）。
 */
import type { ImageFormat } from "~/lib/codecs/format";
import type { ProcessErrorCode, ProcessSettings, ProcessWarning } from "~/lib/pipeline/types";

export type ToolItemStatus = "queued" | "processing" | "done" | "error" | "skipped";

export type ToolErrorCode =
  | ProcessErrorCode
  | "file_too_large"
  | "zip_too_large"
  | "zip_total_too_large"
  | "zip_too_many_entries"
  | "zip_read_failed"
  | "zip_write_failed"
  | "share_failed"
  | "cancelled";

export interface ToolOutput {
  name: string;
  path: string;
  format: ImageFormat;
  blob: Blob;
  width: number | null;
  height: number | null;
  quality: number | null;
  variantWidth: number | null;
}

export interface ToolResult {
  inputFormat: ImageFormat;
  inputBytes: number;
  inputWidth: number | null;
  inputHeight: number | null;
  outputs: ToolOutput[];
  warnings: ProcessWarning[];
}

/** ZIP から取り出した項目の出どころ。処理が済んだら元データを解放し、必要なときにここから読み直す */
export interface ZipOrigin {
  zip: File;
  /** ZIP 内の元のエントリ名（正規化前） */
  entryName: string;
}

export interface ToolItem {
  id: string;
  name: string;
  /** フォルダ・ZIP 由来の相対パス。単体なら name と同じ */
  path: string;
  /**
   * 元データ。File 入力ならその File（ディスク上）。ZIP 由来なら展開した Blob で、
   * 処理が済んだら null にして解放する（origin から読み直せる）
   */
  source: Blob | null;
  origin?: ZipOrigin;
  size: number;
  type: string;
  status: ToolItemStatus;
  result?: ToolResult;
  error?: ToolErrorCode;
  /** done / error になったときの設定。今の設定と違えば再処理する（ページをまたいでも） */
  appliedSettings?: ProcessSettings;
}

/** 入力全体に関わる通知（ZIP の上限で止まった等）。項目に紐付かないのでここに出す */
export interface ToolNotice {
  id: string;
  code: ToolErrorCode;
  /** 文言の置換用（上限の値など） */
  detail?: string;
}

/** 一括保存の分割（1 本ずつ保存ボタンにする） */
export interface ZipPartPlan {
  index: number;
  name: string;
  /** この分割に入れる出力（項目 id と出力の添字） */
  entries: { itemId: string; outputIndex: number }[];
  bytes: number;
  saved: boolean;
}

export const OUTPUT_BYTES = (item: ToolItem): number =>
  item.result ? item.result.outputs.reduce((s, o) => s + o.blob.size, 0) : 0;
