/**
 * 騒音計の本体：届いた波形のすべてのサンプルに周波数の重み付けをかけ、
 * 2 乗した値に時間の重み付け（指数平均。Fast 0.125 秒・Slow 1 秒）をかけてレベルを追う（IEC 61672-1 の方式）
 */
import { SETTLE_SEC } from "../../../domain/limits";
import { TIME_CONSTANT_SEC, type Weighting } from "../../../domain/measurement";
import { powerToDb } from "./levels";
import { createWeightingFilter } from "./weighting";

export interface MeterReading {
  /** 解析したサンプルの数 */
  sampleCount: number;
  /** 最後のサンプルでの、時間の重み付けをかけたレベル（dBFS） */
  levelDbfs: number;
  /** この区間のエネルギーの平均（dBFS） */
  leqDbfs: number;
  /** この区間の、時間の重み付けをかけたレベルの最大・最小（dBFS） */
  maxDbfs: number;
  minDbfs: number;
}

export interface LevelMeter {
  /**
   * 前回の続きの波形を渡す。音が届き始めるまで（マイクの準備中はデジタルの 0 が来る）、フィルタが落ち着くまで
   * （届き始めてから SETTLE_SEC 秒）、サンプルが無いときは null
   */
  process(samples: ArrayLike<number>): MeterReading | null;
}

export function createLevelMeter(weighting: Weighting, sampleRate: number): LevelMeter {
  const filter = createWeightingFilter(weighting.frequency, sampleRate);
  const alpha = 1 - Math.exp(-1 / (TIME_CONSTANT_SEC[weighting.time] * sampleRate));
  let started = false;
  let settleRemaining = Math.round(SETTLE_SEC * sampleRate);
  /** 時間の重み付けをかけた 2 乗の値。未定（null）なら最初の区間の平均から始める（立ち上がりを待たない） */
  let weighted: number | null = null;
  let buffer = new Float64Array(0);

  return {
    process(samples) {
      if (buffer.length < samples.length) buffer = new Float64Array(samples.length);
      filter.process(samples, buffer);
      // 落ち着くまでの時間は、音が届き始めてから数える（0 の間に数え終えると、立ち上がりの揺れを最大に数える）
      let first = 0;
      if (!started) {
        while (first < samples.length && samples[first] === 0) first++;
        if (first === samples.length) return null;
        started = true;
      }
      const settled = Math.min(samples.length - first, settleRemaining);
      settleRemaining -= settled;
      const start = first + settled;
      const count = samples.length - start;
      if (count <= 0) return null;

      let sum = 0;
      for (let i = start; i < samples.length; i++) sum += (buffer[i] ?? 0) ** 2;
      let level = weighted ?? sum / count;
      let max = 0;
      let min = Number.POSITIVE_INFINITY;
      for (let i = start; i < samples.length; i++) {
        level += alpha * ((buffer[i] ?? 0) ** 2 - level);
        if (level > max) max = level;
        if (level < min) min = level;
      }
      weighted = level;
      return {
        sampleCount: count,
        levelDbfs: powerToDb(level),
        leqDbfs: powerToDb(sum / count),
        maxDbfs: powerToDb(max),
        minDbfs: powerToDb(min),
      };
    },
  };
}
