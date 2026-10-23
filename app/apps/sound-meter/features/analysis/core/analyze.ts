/** 1 回分の波形とスペクトルを解析し、計測全体を集計する */
import { PITCH_MAX_HZ, PITCH_MIN_HZ, SILENCE_DBFS } from "../../../domain/limits";
import {
  BANDS,
  type BandId,
  type FrameAnalysis,
  type MeasurementSummary,
} from "../../../domain/measurement";
import { dbToPower, energyAverageDb, peak, percentLevel, rms, toDb } from "./levels";
import type { AudioFrame } from "./port";
import {
  aWeightingOffsetDb,
  bandPowers,
  dominantFrequency,
  spectralCentroid,
  toShares,
} from "./spectrum";

/** これより小さい音では周波数を求めない（雑音の山を拾うだけになる） */
const PITCH_GATE_DBFS = -80;

function emptyShares(): Record<BandId, number> {
  return Object.fromEntries(BANDS.map((band) => [band.id, 0])) as Record<BandId, number>;
}

export function analyzeFrame(frame: AudioFrame, timeMs: number): FrameAnalysis {
  const levelDbfs = toDb(rms(frame.samples));
  const silent = levelDbfs <= SILENCE_DBFS;
  const audible = levelDbfs > PITCH_GATE_DBFS;
  return {
    timeMs,
    levelDbfs,
    levelADbfs: silent
      ? SILENCE_DBFS
      : Math.max(SILENCE_DBFS, levelDbfs + aWeightingOffsetDb(frame.spectrumDb, frame.sampleRate)),
    peakDbfs: toDb(peak(frame.samples)),
    dominantHz: audible
      ? dominantFrequency(frame.spectrumDb, frame.sampleRate, PITCH_MIN_HZ, PITCH_MAX_HZ)
      : null,
    centroidHz: audible ? spectralCentroid(frame.spectrumDb, frame.sampleRate) : null,
    bandShares: silent
      ? emptyShares()
      : toShares(bandPowers(frame.spectrumDb, frame.sampleRate, BANDS)),
  };
}

/** 半音単位でいちばん多く現れた周波数（その半音に入った値の中央値） */
function modeFrequency(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const groups = new Map<number, number[]>();
  for (const hz of values) {
    const key = Math.round(12 * Math.log2(hz / 440));
    groups.set(key, [...(groups.get(key) ?? []), hz]);
  }
  let best: number[] = [];
  for (const group of groups.values()) if (group.length > best.length) best = group;
  const sorted = [...best].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const center = sorted[middle] ?? null;
  if (center === null || sorted.length % 2) return center;
  return ((sorted[middle - 1] ?? center) + center) / 2;
}

/** 完全な無音（デジタルの 0）は入力が無い状態なので、集計に入れない（ミュート・偽の入力の合間等） */
export function isSilentFrame(frame: FrameAnalysis): boolean {
  return frame.levelDbfs <= SILENCE_DBFS;
}

export function summarize(
  frames: readonly FrameAnalysis[],
  durationMs: number,
): MeasurementSummary {
  const levels = frames.filter((frame) => !isSilentFrame(frame)).map((frame) => frame.levelADbfs);
  const bands = emptyShares();
  let centroidWeight = 0;
  let centroidSum = 0;
  for (const frame of frames) {
    const power = dbToPower(frame.levelDbfs);
    for (const band of BANDS) bands[band.id] += frame.bandShares[band.id] * power;
    if (frame.centroidHz !== null) {
      centroidWeight += power;
      centroidSum += frame.centroidHz * power;
    }
  }
  return {
    durationMs,
    frames: frames.length,
    audibleFrames: levels.length,
    leqDbfs: energyAverageDb(levels),
    maxDbfs: levels.length ? Math.max(...levels) : SILENCE_DBFS,
    minDbfs: levels.length ? Math.min(...levels) : SILENCE_DBFS,
    l10Dbfs: percentLevel(levels, 10),
    l50Dbfs: percentLevel(levels, 50),
    l90Dbfs: percentLevel(levels, 90),
    peakDbfs: frames.length ? Math.max(...frames.map((frame) => frame.peakDbfs)) : SILENCE_DBFS,
    dominantHz: modeFrequency(
      frames.flatMap((frame) => (frame.dominantHz === null ? [] : [frame.dominantHz])),
    ),
    centroidHz: centroidWeight > 0 ? centroidSum / centroidWeight : null,
    bandShares: toShares(bands),
  };
}
