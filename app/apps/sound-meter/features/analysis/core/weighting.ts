/**
 * 周波数の重み付け（IEC 61672-1 の A・C・Z）を波形にかけるデジタルフィルタ。
 * 規格のアナログの式（極 20.6Hz・107.7Hz・737.9Hz・12194Hz）を 1 次の区間に分け、
 * それぞれを双一次変換でデジタルにする。1kHz で 0dB になるよう利得を合わせる。
 * 誤差は 4kHz まで 0.1dB 以内、8kHz で約 -0.7dB（規格のクラス 1 の許容差の内側）
 */
import type { FrequencyWeighting } from "../../../domain/measurement";

/** 規格の極（Hz） */
const POLE_HZ = { f1: 20.598997, f2: 107.65265, f3: 737.86223, f4: 12194.217 } as const;
/** Z 特性で直流（マイクの偏り）だけを除く高域通過の周波数（Hz） */
const Z_HIGHPASS_HZ = 2;

/** 1 次の区間：H(z) = (b0 + b1 z⁻¹) / (1 + a1 z⁻¹) */
interface Section {
  b0: number;
  b1: number;
  a1: number;
}

type SectionKind = "highpass" | "lowpass";

function section(kind: SectionKind, hz: number, sampleRate: number): Section {
  const k = 2 * sampleRate;
  // 極の周波数を伸ばす補正（プリワーピング）はしない。すると 12194Hz の極が動いて 4〜10kHz が持ち上がり、
  // 騒音の主な帯域の誤差が増える
  const w = 2 * Math.PI * hz;
  const a1 = (w - k) / (k + w);
  return kind === "highpass"
    ? { b0: k / (k + w), b1: -k / (k + w), a1 }
    : { b0: w / (k + w), b1: w / (k + w), a1 };
}

function sections(weighting: FrequencyWeighting, sampleRate: number): Section[] {
  const { f1, f2, f3, f4 } = POLE_HZ;
  const hp = (hz: number) => section("highpass", hz, sampleRate);
  const lp = (hz: number) => section("lowpass", hz, sampleRate);
  switch (weighting) {
    case "A":
      return [hp(f1), hp(f1), hp(f2), hp(f3), lp(f4), lp(f4)];
    case "C":
      return [hp(f1), hp(f1), lp(f4), lp(f4)];
    case "Z":
      return [hp(Z_HIGHPASS_HZ)];
  }
}

/** 区間を並べたときの周波数 hz での振幅 */
function magnitude(list: readonly Section[], hz: number, sampleRate: number): number {
  const omega = (2 * Math.PI * hz) / sampleRate;
  const re = Math.cos(omega);
  const im = -Math.sin(omega);
  let gain = 1;
  for (const { b0, b1, a1 } of list) {
    const num = Math.hypot(b0 + b1 * re, b1 * im);
    const den = Math.hypot(1 + a1 * re, a1 * im);
    gain *= num / den;
  }
  return gain;
}

/** フィルタの周波数特性（dB。1kHz で 0）。検証用 */
export function weightingResponseDb(
  weighting: FrequencyWeighting,
  hz: number,
  sampleRate: number,
): number {
  const list = sections(weighting, sampleRate);
  return 20 * Math.log10(magnitude(list, hz, sampleRate) / magnitude(list, 1000, sampleRate));
}

export interface WeightingFilter {
  /** samples に重み付けをかけて out に書く（状態を持つので、続きの波形を順に渡す） */
  process(samples: ArrayLike<number>, out: Float64Array): void;
}

export function createWeightingFilter(
  weighting: FrequencyWeighting,
  sampleRate: number,
): WeightingFilter {
  const list = sections(weighting, sampleRate);
  const gain = 1 / magnitude(list, 1000, sampleRate);
  const x1 = new Float64Array(list.length);
  const y1 = new Float64Array(list.length);
  return {
    process(samples, out) {
      for (let i = 0; i < samples.length; i++) {
        let value = (samples[i] ?? 0) * gain;
        for (let s = 0; s < list.length; s++) {
          const { b0, b1, a1 } = list[s] as Section;
          const y = b0 * value + b1 * (x1[s] ?? 0) - a1 * (y1[s] ?? 0);
          x1[s] = value;
          y1[s] = y;
          value = y;
        }
        out[i] = value;
      }
    },
  };
}
