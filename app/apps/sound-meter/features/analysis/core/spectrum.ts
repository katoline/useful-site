/** スペクトル（ビンごとの dB）から読み取る値：A 特性・主な周波数・重心・帯域・表示用の棒 */
import type { Band, BandId } from "../../../domain/measurement";
import { dbToPower, powerToDb } from "./levels";

function binHz(index: number, sampleRate: number, binCount: number): number {
  return (index * sampleRate) / (binCount * 2);
}

/** i 番目のビンの dB（範囲外・-Infinity は -Infinity） */
function binDb(spectrumDb: ArrayLike<number>, index: number): number {
  return spectrumDb[index] ?? Number.NEGATIVE_INFINITY;
}

function binPower(db: number): number {
  return Number.isFinite(db) ? dbToPower(db) : 0;
}

/** A 特性の補正量（dB）。IEC 61672 の近似式。1kHz で 0 */
export function aWeightingDb(hz: number): number {
  if (hz <= 0) return Number.NEGATIVE_INFINITY;
  const f2 = hz * hz;
  const ra =
    (12194 ** 2 * f2 * f2) /
    ((f2 + 20.6 ** 2) * Math.sqrt((f2 + 107.7 ** 2) * (f2 + 737.9 ** 2)) * (f2 + 12194 ** 2));
  return 20 * Math.log10(ra) + 2.0;
}

/**
 * A 特性をかけると全体のエネルギーが何 dB 変わるか。
 * 波形から求めたレベルに足すと A 特性のレベルになる（スペクトルの絶対値の尺度に依らない）
 */
export function aWeightingOffsetDb(spectrumDb: ArrayLike<number>, sampleRate: number): number {
  let total = 0;
  let weighted = 0;
  for (let i = 1; i < spectrumDb.length; i++) {
    const power = binPower(binDb(spectrumDb, i));
    total += power;
    weighted += power * dbToPower(aWeightingDb(binHz(i, sampleRate, spectrumDb.length)));
  }
  if (total === 0) return 0;
  return powerToDb(weighted) - powerToDb(total);
}

/** 範囲の中でいちばん強い周波数（Hz）。前後のビンで放物線補間する */
export function dominantFrequency(
  spectrumDb: ArrayLike<number>,
  sampleRate: number,
  minHz: number,
  maxHz: number,
): number | null {
  const n = spectrumDb.length;
  const resolution = sampleRate / (n * 2);
  const from = Math.max(1, Math.ceil(minHz / resolution));
  const to = Math.min(n - 2, Math.floor(maxHz / resolution));
  let best = -1;
  for (let i = from; i <= to; i++) {
    const db = binDb(spectrumDb, i);
    if (Number.isFinite(db) && (best < 0 || db > binDb(spectrumDb, best))) best = i;
  }
  if (best < 0) return null;
  const left = binDb(spectrumDb, best - 1);
  const center = binDb(spectrumDb, best);
  const right = binDb(spectrumDb, best + 1);
  let offset = 0;
  if (Number.isFinite(left) && Number.isFinite(right)) {
    const denominator = left - 2 * center + right;
    if (denominator !== 0)
      offset = Math.max(-0.5, Math.min(0.5, (0.5 * (left - right)) / denominator));
  }
  return (best + offset) * resolution;
}

/** スペクトル重心（エネルギーで重み付けした周波数の平均）。音の「明るさ」の目安 */
export function spectralCentroid(spectrumDb: ArrayLike<number>, sampleRate: number): number | null {
  let total = 0;
  let weighted = 0;
  for (let i = 1; i < spectrumDb.length; i++) {
    const power = binPower(binDb(spectrumDb, i));
    total += power;
    weighted += power * binHz(i, sampleRate, spectrumDb.length);
  }
  return total > 0 ? weighted / total : null;
}

/** 帯域ごとのエネルギー（パワー比。帯域の外は数えない） */
export function bandPowers(
  spectrumDb: ArrayLike<number>,
  sampleRate: number,
  bands: readonly Band[],
): Record<BandId, number> {
  const result = Object.fromEntries(bands.map((band) => [band.id, 0])) as Record<BandId, number>;
  for (let i = 1; i < spectrumDb.length; i++) {
    const hz = binHz(i, sampleRate, spectrumDb.length);
    const band = bands.find((b) => hz >= b.minHz && hz < b.maxHz);
    if (band) result[band.id] += binPower(binDb(spectrumDb, i));
  }
  return result;
}

/** 合計が 1 になるよう割合にする（合計 0 ならすべて 0） */
export function toShares<K extends string>(values: Record<K, number>): Record<K, number> {
  const entries = Object.entries(values) as [K, number][];
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  return Object.fromEntries(
    entries.map(([key, value]) => [key, total > 0 ? value / total : 0]),
  ) as Record<K, number>;
}

/**
 * 表示用の棒：minHz〜maxHz を対数で count 本に分け、各区間の最大の dB を返す。
 * 低域でビンより細い区間は、その区間を含むビンを使う
 */
export function spectrumBars(
  spectrumDb: ArrayLike<number>,
  sampleRate: number,
  count: number,
  minHz: number,
  maxHz: number,
  floorDb: number,
): number[] {
  const n = spectrumDb.length;
  const resolution = sampleRate / (n * 2);
  const ratio = maxHz / minHz;
  return Array.from({ length: count }, (_, k) => {
    const lowHz = minHz * ratio ** (k / count);
    const highHz = minHz * ratio ** ((k + 1) / count);
    const from = Math.max(1, Math.floor(lowHz / resolution));
    const to = Math.min(n - 1, Math.max(from, Math.ceil(highHz / resolution) - 1));
    let max = floorDb;
    for (let i = from; i <= to; i++) {
      const db = binDb(spectrumDb, i);
      if (Number.isFinite(db)) max = Math.max(max, db);
    }
    return max;
  });
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

/** 周波数に最も近い音名（A4 = 440Hz）と、そこからのずれ（セント） */
export function noteOf(hz: number): { name: string; cents: number } | null {
  if (!(hz > 0)) return null;
  const semitones = 12 * Math.log2(hz / 440);
  const nearest = Math.round(semitones);
  const midi = nearest + 69;
  const name = `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
  return { name, cents: Math.round((semitones - nearest) * 100) };
}
