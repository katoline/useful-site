/** 1 回分の波形とスペクトルを解析し、計測全体を集計する */
import { PITCH_MAX_HZ, PITCH_MIN_HZ, SILENCE_DBFS } from "../../../domain/limits";
import {
  BANDS,
  type BandId,
  type FrameAnalysis,
  type MeasurementSummary,
  type Weighting,
} from "../../../domain/measurement";
import { dbToPower, peak, percentLevel, powerToDb, rms, toDb } from "./levels";
import { createLevelMeter, type LevelMeter } from "./meter";
import type { AudioFrame } from "./port";
import { bandPowers, dominantFrequency, spectralCentroid, toShares } from "./spectrum";

/** これより小さい音では周波数を求めない（雑音の山を拾うだけになる） */
const PITCH_GATE_DBFS = -80;

function emptyShares(): Record<BandId, number> {
  return Object.fromEntries(BANDS.map((band) => [band.id, 0])) as Record<BandId, number>;
}

export interface FrameAnalyzer {
  /**
   * 前回から届いた音を解析する。続きの波形を順に渡す（フィルタと時間の重み付けの状態を持つ）。
   * まだ解析できる音が無い（届いていない・フィルタが落ち着く前）なら null
   */
  analyze(frame: AudioFrame, timeMs: number): FrameAnalysis | null;
}

export function createFrameAnalyzer(weighting: Weighting): FrameAnalyzer {
  let meter: LevelMeter | null = null;
  let meterRate = 0;
  return {
    analyze(frame, timeMs) {
      if (!meter || meterRate !== frame.sampleRate) {
        meter = createLevelMeter(weighting, frame.sampleRate);
        meterRate = frame.sampleRate;
      }
      const reading = meter.process(frame.samples);
      if (!reading) return null;
      const rawDbfs = toDb(rms(frame.samples));
      const silent = rawDbfs <= SILENCE_DBFS;
      const audible = rawDbfs > PITCH_GATE_DBFS;
      return {
        timeMs,
        sampleCount: reading.sampleCount,
        rawDbfs,
        levelDbfs: reading.levelDbfs,
        leqDbfs: reading.leqDbfs,
        maxDbfs: reading.maxDbfs,
        minDbfs: reading.minDbfs,
        peakDbfs: toDb(peak(frame.samples)),
        dominantHz: audible
          ? dominantFrequency(frame.spectrumDb, frame.sampleRate, PITCH_MIN_HZ, PITCH_MAX_HZ)
          : null,
        centroidHz: audible ? spectralCentroid(frame.spectrumDb, frame.sampleRate) : null,
        bandShares: silent
          ? emptyShares()
          : toShares(bandPowers(frame.spectrumDb, frame.sampleRate, BANDS)),
      };
    },
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
  return frame.rawDbfs <= SILENCE_DBFS;
}

/**
 * 計測全体を集計する。Leq はすべてのサンプルのエネルギーの平均、最大・最小は時間の重み付けをかけたレベルの
 * 最大・最小、Lx は解析ごと（0.1 秒ごと）に読んだレベルから求める
 */
export function summarize(
  frames: readonly FrameAnalysis[],
  durationMs: number,
  weighting: Weighting,
): MeasurementSummary {
  const audible = frames.filter((frame) => !isSilentFrame(frame));
  const levels = audible.map((frame) => frame.levelDbfs);
  let energy = 0;
  let samples = 0;
  for (const frame of audible) {
    energy += dbToPower(frame.leqDbfs) * frame.sampleCount;
    samples += frame.sampleCount;
  }
  const bands = emptyShares();
  let centroidWeight = 0;
  let centroidSum = 0;
  for (const frame of frames) {
    const power = dbToPower(frame.rawDbfs) * frame.sampleCount;
    for (const band of BANDS) bands[band.id] += frame.bandShares[band.id] * power;
    if (frame.centroidHz !== null) {
      centroidWeight += power;
      centroidSum += frame.centroidHz * power;
    }
  }
  return {
    weighting,
    durationMs,
    frames: frames.length,
    audibleFrames: audible.length,
    leqDbfs: samples > 0 ? powerToDb(energy / samples) : SILENCE_DBFS,
    maxDbfs: audible.length ? Math.max(...audible.map((frame) => frame.maxDbfs)) : SILENCE_DBFS,
    minDbfs: audible.length ? Math.min(...audible.map((frame) => frame.minDbfs)) : SILENCE_DBFS,
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
