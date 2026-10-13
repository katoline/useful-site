/**
 * サイズ上限（plan.md §5）。上限は通信ではなくブラウザのメモリで決まるので、
 * ファイルサイズよりピクセル数で制限する。値はここ 1 か所にまとめ、実機で落ちる値を測って調整する。
 */

export type DeviceClass = "desktop" | "mobile";

export interface Limits {
  /** 1 枚のピクセル数（幅 × 高さ） */
  maxPixels: number;
  /** 1 ファイルのサイズ（バイト） */
  maxFileBytes: number;
  /** ZIP 入力のサイズ（バイト） */
  maxZipBytes: number;
  /** ZIP 展開後の合計（バイト） */
  maxZipTotalBytes: number;
  /** ZIP 展開後の件数 */
  maxZipEntries: number;
  /** URL 入力（Worker 経由。§3.5） */
  maxUrlBytes: number;
  /** Blob でまとめる ZIP 出力 1 本の上限。超えそうなら分割 ZIP にする */
  maxZipBlobBytes: number;
  /** 同時に動かす Web Worker の最大数 */
  maxWorkers: number;
}

const MB = 1024 * 1024;
const GB = 1024 * MB;

export const LIMITS: Record<DeviceClass, Limits> = {
  desktop: {
    maxPixels: 100_000_000,
    maxFileBytes: 200 * MB,
    maxZipBytes: 2 * GB,
    maxZipTotalBytes: 4 * GB,
    maxZipEntries: 5000,
    maxUrlBytes: 25 * MB,
    maxZipBlobBytes: 1 * GB,
    maxWorkers: 4,
  },
  mobile: {
    maxPixels: 40_000_000,
    maxFileBytes: 50 * MB,
    maxZipBytes: 500 * MB,
    maxZipTotalBytes: 1 * GB,
    maxZipEntries: 1000,
    maxUrlBytes: 25 * MB,
    maxZipBlobBytes: 256 * MB,
    maxWorkers: 2,
  },
};

export function limitsFor(device: DeviceClass): Limits {
  return LIMITS[device];
}

/** Web Worker の数（§3.4）。hardwareConcurrency から決め、スマホでは最大 2 */
export function workerCount(device: DeviceClass, hardwareConcurrency?: number): number {
  const cores = Math.max(1, hardwareConcurrency ?? 2);
  // 1 コアは UI 用に残す
  return Math.max(1, Math.min(LIMITS[device].maxWorkers, cores - 1));
}

export type LimitViolation = "file_too_large" | "too_many_pixels" | "zip_too_large";

/** 1 ファイルのサイズ検査。超えたら飛ばして案内を出す（エラーにはしない） */
export function checkFileSize(bytes: number, limits: Limits): LimitViolation | null {
  return bytes > limits.maxFileBytes ? "file_too_large" : null;
}

export function checkPixels(width: number, height: number, limits: Limits): LimitViolation | null {
  return width * height > limits.maxPixels ? "too_many_pixels" : null;
}

export function checkZipSize(bytes: number, limits: Limits): LimitViolation | null {
  return bytes > limits.maxZipBytes ? "zip_too_large" : null;
}
