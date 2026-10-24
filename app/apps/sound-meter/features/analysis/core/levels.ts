/** 音の大きさの計算（dBFS）と時間方向の集計 */
import { SILENCE_DBFS } from "../../../domain/limits";

export function toDb(amplitude: number): number {
  return amplitude > 0 ? Math.max(SILENCE_DBFS, 20 * Math.log10(amplitude)) : SILENCE_DBFS;
}

/** dB → エネルギー（パワー比） */
export function dbToPower(db: number): number {
  return 10 ** (db / 10);
}

export function powerToDb(power: number): number {
  return power > 0 ? Math.max(SILENCE_DBFS, 10 * Math.log10(power)) : SILENCE_DBFS;
}

/** 実効値（RMS） */
export function rms(samples: ArrayLike<number>): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += (samples[i] ?? 0) ** 2;
  return Math.sqrt(sum / samples.length);
}

/** 絶対値の最大 */
export function peak(samples: ArrayLike<number>): number {
  let max = 0;
  for (let i = 0; i < samples.length; i++) max = Math.max(max, Math.abs(samples[i] ?? 0));
  return max;
}

/**
 * 時間率騒音レベル Lx：計測時間の x% でこの値を超えていた、というレベル。
 * L10 は大きい方、L90 は小さい方（暗騒音）の目安。線形補間する
 */
export function percentLevel(levels: readonly number[], x: number): number {
  if (levels.length === 0) return SILENCE_DBFS;
  const sorted = [...levels].sort((a, b) => a - b);
  const position = (1 - x / 100) * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const low = sorted[lower] ?? SILENCE_DBFS;
  const high = sorted[upper] ?? low;
  return low + (high - low) * (position - lower);
}
