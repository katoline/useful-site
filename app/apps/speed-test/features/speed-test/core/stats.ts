/** 測った値の集計（応答時間の中央値・ぶれ、転送量から速度） */
import type { LatencyResult } from "../../../domain/measurement";

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const center = sorted[middle] ?? 0;
  return sorted.length % 2 ? center : ((sorted[middle - 1] ?? center) + center) / 2;
}

/** ジッター：続けて測った値の差（絶対値）の平均 */
export function jitter(values: readonly number[]): number {
  if (values.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < values.length; i++) sum += Math.abs((values[i] ?? 0) - (values[i - 1] ?? 0));
  return sum / (values.length - 1);
}

export function summarizeLatency(values: readonly number[]): LatencyResult {
  return {
    pingMs: median(values),
    jitterMs: jitter(values),
    minMs: values.length ? Math.min(...values) : 0,
    samples: values.length,
  };
}

/** バイト数と時間（ミリ秒）から Mbps */
export function toMbps(bytes: number, ms: number): number {
  return ms > 0 ? (bytes * 8) / ms / 1000 : 0;
}

/** 転送の記録：開始からの時間（ミリ秒）と、その時点までの合計バイト数 */
export interface TransferSample {
  t: number;
  bytes: number;
}

/** 時刻 t の時点の合計バイト数（記録の間は直線で補う） */
export function bytesAt(samples: readonly TransferSample[], t: number): number {
  let previous: TransferSample = { t: 0, bytes: 0 };
  for (const sample of samples) {
    if (sample.t >= t) {
      const span = sample.t - previous.t;
      return span > 0
        ? previous.bytes + ((sample.bytes - previous.bytes) * (t - previous.t)) / span
        : sample.bytes;
    }
    previous = sample;
  }
  return previous.bytes;
}

/**
 * 結果の速度：始めの warmupMs（接続の立ち上がり）を除いた区間の平均。
 * 測定が短く区間が取れないときは全体の平均
 */
export function steadyMbps(samples: readonly TransferSample[], warmupMs: number): number {
  const last = samples.at(-1);
  if (!last) return 0;
  if (last.t <= warmupMs * 1.5) return toMbps(last.bytes, last.t);
  return toMbps(last.bytes - bytesAt(samples, warmupMs), last.t - warmupMs);
}

/** 直近 windowMs の速度（測定中の表示用） */
export function recentMbps(samples: readonly TransferSample[], windowMs: number): number {
  const last = samples.at(-1);
  if (!last) return 0;
  const from = Math.max(0, last.t - windowMs);
  return toMbps(last.bytes - bytesAt(samples, from), last.t - from);
}
