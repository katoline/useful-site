/** feature 内の純粋関数を DOM なしで検証する。 */
import { describe, expect, it } from "vitest";
import { DEFAULT_CALIBRATION_DB, SILENCE_DBFS } from "../../../domain/limits";
import { BANDS, loudnessLevel } from "../../../domain/measurement";
import { analyzeFrame, summarize } from "../core/analyze";
import { framesToCsv } from "../core/csv";
import { energyAverageDb, peak, percentLevel, rms, toDb } from "../core/levels";
import { validateMeterSettings } from "../core/settings";
import {
  aWeightingDb,
  aWeightingOffsetDb,
  bandPowers,
  dominantFrequency,
  noteOf,
  spectralCentroid,
  spectrumBars,
} from "../core/spectrum";

const SAMPLE_RATE = 48000;
const BINS = 2048;
const resolution = SAMPLE_RATE / (BINS * 2);

function sine(hz: number, amplitude: number, length = BINS * 2): Float32Array {
  return Float32Array.from(
    { length },
    (_, i) => amplitude * Math.sin((2 * Math.PI * hz * i) / SAMPLE_RATE),
  );
}

/** 指定の周波数だけに山があるスペクトル（ビンごとの dB） */
function spectrumWithPeak(hz: number, db = -20): Float32Array {
  const spectrum = new Float32Array(BINS).fill(-140);
  const bin = Math.round(hz / resolution);
  spectrum[bin - 1] = db - 6;
  spectrum[bin] = db;
  spectrum[bin + 1] = db - 6;
  return spectrum;
}

describe("レベル", () => {
  it("フルスケールの正弦波は約 -3dBFS、0 は無音", () => {
    expect(toDb(rms(sine(1000, 1)))).toBeCloseTo(-3.01, 1);
    expect(toDb(peak(sine(1000, 0.5)))).toBeCloseTo(-6.02, 1);
    expect(toDb(0)).toBe(SILENCE_DBFS);
    expect(rms([])).toBe(0);
  });

  it("Leq はエネルギーの平均", () => {
    expect(energyAverageDb([60, 60])).toBeCloseTo(60);
    expect(energyAverageDb([60, 70])).toBeCloseTo(67.4, 1);
    expect(energyAverageDb([])).toBe(SILENCE_DBFS);
  });

  it("L10 は大きい方、L90 は小さい方", () => {
    const levels = Array.from({ length: 11 }, (_, i) => 40 + i);
    expect(percentLevel(levels, 10)).toBeCloseTo(49);
    expect(percentLevel(levels, 50)).toBeCloseTo(45);
    expect(percentLevel(levels, 90)).toBeCloseTo(41);
  });
});

describe("スペクトル", () => {
  it("A 特性は 1kHz で 0、低音で大きく下がる", () => {
    expect(aWeightingDb(1000)).toBeCloseTo(0, 1);
    expect(aWeightingDb(100)).toBeCloseTo(-19.1, 0);
    expect(aWeightingOffsetDb(spectrumWithPeak(1000), SAMPLE_RATE)).toBeCloseTo(0, 0);
    expect(aWeightingOffsetDb(spectrumWithPeak(100), SAMPLE_RATE)).toBeLessThan(-15);
  });

  it("主な周波数を補間して求める", () => {
    const hz = dominantFrequency(spectrumWithPeak(440), SAMPLE_RATE, 50, 8000);
    expect(hz).not.toBeNull();
    expect(Math.abs((hz ?? 0) - 440)).toBeLessThan(resolution / 2);
    expect(
      dominantFrequency(new Float32Array(BINS).fill(-Infinity), SAMPLE_RATE, 50, 8000),
    ).toBeNull();
  });

  it("重心・帯域・表示用の棒", () => {
    expect(spectralCentroid(spectrumWithPeak(2000), SAMPLE_RATE)).toBeCloseTo(2000, -2);
    const bands = bandPowers(spectrumWithPeak(2000), SAMPLE_RATE, BANDS);
    expect(bands.highMid).toBeGreaterThan(bands.low * 1000);
    const bars = spectrumBars(spectrumWithPeak(1000), SAMPLE_RATE, 32, 50, 16000, -120);
    expect(bars).toHaveLength(32);
    expect(Math.max(...bars)).toBe(-20);
  });

  it("音名とセント", () => {
    expect(noteOf(440)).toEqual({ name: "A4", cents: 0 });
    expect(noteOf(261.63)).toEqual({ name: "C4", cents: 0 });
    expect(noteOf(450)?.name).toBe("A4");
    expect(noteOf(0)).toBeNull();
  });
});

describe("解析と集計", () => {
  const frame = (timeMs: number, amplitude: number, hz = 1000) =>
    analyzeFrame(
      { samples: sine(hz, amplitude), spectrumDb: spectrumWithPeak(hz), sampleRate: SAMPLE_RATE },
      timeMs,
    );

  it("1 回分の解析", () => {
    const result = frame(0, 0.1, 2000);
    expect(result.levelDbfs).toBeCloseTo(-23, 0);
    expect(result.levelADbfs).toBeCloseTo(-21.8, 0);
    expect(Math.abs((result.dominantHz ?? 0) - 2000)).toBeLessThan(resolution);
    expect(result.bandShares.highMid).toBeGreaterThan(0.99);
  });

  it("無音では周波数を求めない", () => {
    const silent = analyzeFrame(
      {
        samples: new Float32Array(BINS * 2),
        spectrumDb: spectrumWithPeak(1000),
        sampleRate: SAMPLE_RATE,
      },
      0,
    );
    expect(silent.levelADbfs).toBe(SILENCE_DBFS);
    expect(silent.dominantHz).toBeNull();
    expect(Object.values(silent.bandShares)).toEqual([0, 0, 0, 0]);
  });

  it("計測全体を集計する", () => {
    const frames = [frame(0, 0.01, 440), frame(100, 0.1, 440), frame(200, 0.01, 2000)];
    const summary = summarize(frames, 300);
    expect(summary.frames).toBe(3);
    expect(summary.maxDbfs).toBeCloseTo(frames[1]?.levelADbfs ?? 0);
    expect(summary.minDbfs).toBeLessThan(summary.leqDbfs);
    expect(summary.l90Dbfs).toBeLessThanOrEqual(summary.l10Dbfs);
    expect(Math.abs((summary.dominantHz ?? 0) - 440)).toBeLessThan(resolution);
    expect(summarize([], 0).dominantHz).toBeNull();
  });

  it("完全な無音は集計に入れない", () => {
    const silent = analyzeFrame(
      {
        samples: new Float32Array(BINS * 2),
        spectrumDb: spectrumWithPeak(1000),
        sampleRate: SAMPLE_RATE,
      },
      100,
    );
    const loud = frame(0, 0.1, 2000);
    const summary = summarize([loud, silent, silent], 300);
    expect(summary.frames).toBe(3);
    expect(summary.audibleFrames).toBe(1);
    expect(summary.minDbfs).toBeCloseTo(loud.levelADbfs);
    expect(summary.l90Dbfs).toBeCloseTo(loud.levelADbfs);
    expect(summarize([silent], 100).audibleFrames).toBe(0);
  });

  it("CSV にする", () => {
    const csv = framesToCsv([frame(100, 0.1)], 100);
    const [header = "", row = ""] = csv.trim().split("\r\n");
    expect(header.split(",")).toHaveLength(7);
    expect(row.startsWith("0.1,")).toBe(true);
  });
});

describe("設定・目安", () => {
  it("不正な項目だけ既定値に戻す", () => {
    expect(validateMeterSettings(null)).toEqual({
      durationSec: 10,
      calibrationDb: DEFAULT_CALIBRATION_DB,
    });
    expect(validateMeterSettings({ durationSec: 30, calibrationDb: 999 })).toEqual({
      durationSec: 30,
      calibrationDb: 140,
    });
    expect(validateMeterSettings({ durationSec: 7, calibrationDb: "x" }).durationSec).toBe(10);
  });

  it("大きさの目安", () => {
    expect(loudnessLevel(25)).toBe("veryQuiet");
    expect(loudnessLevel(60)).toBe("lively");
    expect(loudnessLevel(100)).toBe("veryLoud");
  });
});
