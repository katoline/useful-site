/** feature 内の純粋関数を DOM なしで検証する。 */
import { describe, expect, it } from "vitest";
import { DEFAULT_CALIBRATION_DB, SETTLE_SEC, SILENCE_DBFS } from "../../../domain/limits";
import {
  BANDS,
  type FrameAnalysis,
  loudnessLevel,
  type Weighting,
} from "../../../domain/measurement";
import { createFrameAnalyzer, summarize } from "../core/analyze";
import { framesToCsv } from "../core/csv";
import { peak, percentLevel, rms, toDb } from "../core/levels";
import { createLevelMeter } from "../core/meter";
import {
  calibrationForReference,
  DEFAULT_METER_SETTINGS,
  effectiveCalibration,
  validateMeterSettings,
} from "../core/settings";
import {
  bandPowers,
  dominantFrequency,
  noteOf,
  spectralCentroid,
  spectrumBars,
} from "../core/spectrum";
import { weightingResponseDb } from "../core/weighting";

const SAMPLE_RATE = 48000;
const BINS = 2048;
const resolution = SAMPLE_RATE / (BINS * 2);

function sine(
  hz: number,
  amplitude: number,
  length = BINS * 2,
  sampleRate = SAMPLE_RATE,
): Float32Array {
  return Float32Array.from(
    { length },
    (_, i) => amplitude * Math.sin((2 * Math.PI * hz * i) / sampleRate),
  );
}

const A_FAST: Weighting = { frequency: "A", time: "fast" };
/** フィルタが落ち着くまでの長さ（サンプル） */
const SETTLE = Math.round(SETTLE_SEC * SAMPLE_RATE);

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

  it("L10 は大きい方、L90 は小さい方", () => {
    const levels = Array.from({ length: 11 }, (_, i) => 40 + i);
    expect(percentLevel(levels, 10)).toBeCloseTo(49);
    expect(percentLevel(levels, 50)).toBeCloseTo(45);
    expect(percentLevel(levels, 90)).toBeCloseTo(41);
  });
});

describe("スペクトル", () => {
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

/** IEC 61672-1 の基準値（dB）と、クラス 1 の許容差（下・上） */
const IEC_TABLE: { hz: number; a: number; c: number; tolerance: [number, number] }[] = [
  { hz: 31.5, a: -39.4, c: -3.0, tolerance: [-1.5, 1.5] },
  { hz: 63, a: -26.2, c: -0.8, tolerance: [-1, 1] },
  { hz: 125, a: -16.1, c: -0.2, tolerance: [-1, 1] },
  { hz: 250, a: -8.6, c: 0, tolerance: [-1, 1] },
  { hz: 500, a: -3.2, c: 0, tolerance: [-1, 1] },
  { hz: 1000, a: 0, c: 0, tolerance: [-0.7, 0.7] },
  { hz: 2000, a: 1.2, c: -0.2, tolerance: [-1, 1] },
  { hz: 4000, a: 1.0, c: -0.8, tolerance: [-1, 1] },
  { hz: 8000, a: -1.1, c: -3.0, tolerance: [-2.5, 1.5] },
  { hz: 12500, a: -4.3, c: -6.2, tolerance: [-5, 2] },
  { hz: 16000, a: -6.6, c: -8.5, tolerance: [-17, 3.5] },
];

describe("周波数の重み付け（フィルタ）", () => {
  for (const sampleRate of [44100, 48000]) {
    it(`A・C 特性が IEC 61672 のクラス 1 の許容差に入る（${sampleRate}Hz）`, () => {
      for (const { hz, a, c, tolerance } of IEC_TABLE) {
        for (const [weighting, nominal] of [
          ["A", a],
          ["C", c],
        ] as const) {
          const error = weightingResponseDb(weighting, hz, sampleRate) - nominal;
          expect(error, `${weighting} ${hz}Hz`).toBeGreaterThanOrEqual(tolerance[0]);
          expect(error, `${weighting} ${hz}Hz`).toBeLessThanOrEqual(tolerance[1]);
        }
      }
      // 普段の騒音の主な帯域（31.5Hz〜4kHz）は、基準値と 0.2dB 以内
      for (const { hz, a, c } of IEC_TABLE.filter((row) => row.hz <= 4000)) {
        expect(Math.abs(weightingResponseDb("A", hz, sampleRate) - a)).toBeLessThan(0.2);
        expect(Math.abs(weightingResponseDb("C", hz, sampleRate) - c)).toBeLessThan(0.2);
      }
    });
  }

  it("Z 特性は平ら（直流だけを除く）", () => {
    for (const hz of [31.5, 100, 1000, 8000]) {
      expect(Math.abs(weightingResponseDb("Z", hz, SAMPLE_RATE))).toBeLessThan(0.3);
    }
    expect(weightingResponseDb("Z", 0.1, SAMPLE_RATE)).toBeLessThan(-20);
  });
});

describe("騒音計（時間の重み付け）", () => {
  it("落ち着くまでは値を出さない。サンプルが無ければ null", () => {
    const meter = createLevelMeter(A_FAST, SAMPLE_RATE);
    expect(meter.process(sine(1000, 0.1, SETTLE))).toBeNull();
    expect(meter.process(new Float32Array(0))).toBeNull();
    expect(meter.process(new Float32Array(100))).not.toBeNull();
  });

  it("落ち着くまでの時間は音が届き始めてから数え、立ち上がりの揺れを最大に数えない", () => {
    const meter = createLevelMeter(A_FAST, SAMPLE_RATE);
    expect(meter.process(new Float32Array(SETTLE * 2))).toBeNull();
    expect(meter.process(sine(1000, 0.1, SETTLE))).toBeNull();
    const reading = meter.process(sine(1000, 0.1, SAMPLE_RATE));
    expect(reading?.maxDbfs).toBeCloseTo(-23.01, 0);
    expect((reading?.maxDbfs ?? 0) - (reading?.leqDbfs ?? 0)).toBeLessThan(0.1);
  });

  it("1kHz の正弦波は重み付けによらず実効値どおり。100Hz は A で約 19dB 下がる", () => {
    const length = SETTLE + SAMPLE_RATE;
    for (const frequency of ["A", "C", "Z"] as const) {
      const meter = createLevelMeter({ frequency, time: "fast" }, SAMPLE_RATE);
      const reading = meter.process(sine(1000, 0.1, length));
      expect(reading?.leqDbfs, frequency).toBeCloseTo(-23.01, 1);
      expect(reading?.levelDbfs, frequency).toBeCloseTo(-23.01, 0);
    }
    const low = createLevelMeter(A_FAST, SAMPLE_RATE).process(sine(100, 0.1, length));
    expect(low?.leqDbfs).toBeCloseTo(-23.01 - 19.1, 0);
    const lowC = createLevelMeter({ frequency: "C", time: "fast" }, SAMPLE_RATE).process(
      sine(100, 0.1, length),
    );
    expect(lowC?.leqDbfs).toBeCloseTo(-23.01 - 0.3, 0);
  });

  it("音が止まると Fast は 0.125 秒、Slow は 1 秒の時定数で下がる（約 34.7dB/秒・4.3dB/秒）", () => {
    for (const [time, perSecond] of [
      ["fast", 34.7],
      ["slow", 4.34],
    ] as const) {
      const meter = createLevelMeter({ frequency: "Z", time }, SAMPLE_RATE);
      meter.process(sine(1000, 0.1, SETTLE + SAMPLE_RATE * 2));
      const before = meter.process(sine(1000, 0.1, 480));
      const after = meter.process(new Float32Array(SAMPLE_RATE / 10));
      const drop = (before?.levelDbfs ?? 0) - (after?.levelDbfs ?? 0);
      expect(drop, time).toBeCloseTo(perSecond / 10, 0);
      expect(after?.maxDbfs, time).toBeGreaterThan(after?.minDbfs ?? 0);
    }
  });

  it("続けて渡した波形はつながったものとして扱う（区切り方で値が変わらない）", () => {
    const signal = sine(440, 0.2, SETTLE + 9600);
    const whole = createLevelMeter(A_FAST, SAMPLE_RATE).process(signal);
    const split = createLevelMeter(A_FAST, SAMPLE_RATE);
    split.process(signal.subarray(0, SETTLE));
    const first = split.process(signal.subarray(SETTLE, SETTLE + 4800));
    const second = split.process(signal.subarray(SETTLE + 4800));
    // 時間の重み付けの初期値（最初の区間の平均）の違いだけが残る
    expect(second?.levelDbfs).toBeCloseTo(whole?.levelDbfs ?? 0, 3);
    expect(Math.max(first?.maxDbfs ?? 0, second?.maxDbfs ?? 0)).toBeCloseTo(whole?.maxDbfs ?? 0, 3);
  });
});

describe("解析と集計", () => {
  /** 落ち着いた後の解析器と、0.1 秒ずつの解析 */
  function analyzer(weighting: Weighting = A_FAST) {
    const instance = createFrameAnalyzer(weighting);
    instance.analyze(
      {
        // 0 から始まると、落ち着くまでの時間が 1 サンプルずれる
        samples: sine(1000, 0.01, SETTLE + 1).subarray(1),
        spectrumDb: spectrumWithPeak(1000),
        sampleRate: SAMPLE_RATE,
      },
      0,
    );
    return (timeMs: number, amplitude: number, hz = 1000): FrameAnalysis => {
      const frame = instance.analyze(
        {
          samples: sine(hz, amplitude, SAMPLE_RATE / 10),
          spectrumDb: spectrumWithPeak(hz),
          sampleRate: SAMPLE_RATE,
        },
        timeMs,
      );
      if (!frame) throw new Error("解析できなかった");
      return frame;
    };
  }

  it("落ち着く前と、音が届いていないときは null", () => {
    const instance = createFrameAnalyzer(A_FAST);
    const empty = {
      samples: new Float32Array(0),
      spectrumDb: spectrumWithPeak(1000),
      sampleRate: SAMPLE_RATE,
    };
    expect(instance.analyze(empty, 0)).toBeNull();
    expect(instance.analyze({ ...empty, samples: new Float32Array(SETTLE - 1) }, 100)).toBeNull();
  });

  it("1 回分の解析", () => {
    const result = analyzer()(0, 0.1, 2000);
    expect(result.rawDbfs).toBeCloseTo(-23, 0);
    expect(result.leqDbfs).toBeCloseTo(-21.8, 0);
    expect(result.sampleCount).toBe(SAMPLE_RATE / 10);
    expect(Math.abs((result.dominantHz ?? 0) - 2000)).toBeLessThan(resolution);
    expect(result.bandShares.highMid).toBeGreaterThan(0.99);
  });

  it("無音では周波数を求めない", () => {
    const silent = analyzer()(0, 0);
    expect(silent.rawDbfs).toBe(SILENCE_DBFS);
    expect(silent.dominantHz).toBeNull();
    expect(Object.values(silent.bandShares)).toEqual([0, 0, 0, 0]);
  });

  it("計測全体を集計する：Leq は全サンプルのエネルギーの平均", () => {
    const frame = analyzer();
    const frames = [frame(0, 0.01, 440), frame(100, 0.1, 440), frame(200, 0.01, 2000)];
    const summary = summarize(frames, 300, A_FAST);
    expect(summary.frames).toBe(3);
    expect(summary.weighting).toEqual(A_FAST);
    const energy = frames.reduce((sum, f) => sum + 10 ** (f.leqDbfs / 10), 0) / 3;
    expect(summary.leqDbfs).toBeCloseTo(10 * Math.log10(energy), 6);
    expect(summary.maxDbfs).toBeCloseTo(Math.max(...frames.map((f) => f.maxDbfs)));
    expect(summary.minDbfs).toBeLessThan(summary.leqDbfs);
    expect(summary.l90Dbfs).toBeLessThanOrEqual(summary.l10Dbfs);
    expect(Math.abs((summary.dominantHz ?? 0) - 440)).toBeLessThan(resolution);
    expect(summarize([], 0, A_FAST).dominantHz).toBeNull();
  });

  it("完全な無音は集計に入れない", () => {
    const frame = analyzer();
    const loud = frame(0, 0.1, 2000);
    const silent = frame(100, 0);
    const summary = summarize([loud, silent, silent], 300, A_FAST);
    expect(summary.frames).toBe(3);
    expect(summary.audibleFrames).toBe(1);
    expect(summary.leqDbfs).toBeCloseTo(loud.leqDbfs);
    expect(summary.l90Dbfs).toBeCloseTo(loud.levelDbfs);
    expect(summarize([silent], 100, A_FAST).audibleFrames).toBe(0);
  });

  it("CSV にする（見出しに重み付けを入れる）", () => {
    const csv = framesToCsv([analyzer()(100, 0.1)], 100, { frequency: "C", time: "slow" });
    const [header = "", row = ""] = csv.trim().split("\r\n");
    expect(header.split(",")).toHaveLength(8);
    expect(header).toContain("estimated_db_c_slow");
    expect(row.startsWith("0.1,")).toBe(true);
  });
});

describe("設定・目安", () => {
  it("不正な項目だけ既定値に戻す", () => {
    expect(validateMeterSettings(null)).toEqual(DEFAULT_METER_SETTINGS);
    expect(
      validateMeterSettings({
        version: 2,
        durationSec: 30,
        calibrationDb: 999,
        frequencyWeighting: "C",
        timeWeighting: "slow",
      }),
    ).toEqual({
      durationSec: 30,
      calibrationDb: 140,
      frequencyWeighting: "C",
      timeWeighting: "slow",
    });
    const broken = validateMeterSettings({
      durationSec: 7,
      calibrationDb: "x",
      frequencyWeighting: "B",
    });
    expect(broken.durationSec).toBe(10);
    expect(broken.calibrationDb).toBeNull();
    expect(broken.frequencyWeighting).toBe("A");
  });

  it("前の版の既定値（100）のままなら端末ごとの既定値に切り替える。選んだ値は残す", () => {
    expect(validateMeterSettings({ durationSec: 10, calibrationDb: 100 }).calibrationDb).toBeNull();
    expect(validateMeterSettings({ durationSec: 10, calibrationDb: 105 }).calibrationDb).toBe(105);
    expect(
      validateMeterSettings({ version: 2, durationSec: 10, calibrationDb: 100 }).calibrationDb,
    ).toBe(100);
  });

  it("補正値：既定は端末の種類ごと、基準の値に合わせられる", () => {
    expect(effectiveCalibration(DEFAULT_METER_SETTINGS, "ios")).toBe(DEFAULT_CALIBRATION_DB.ios);
    expect(effectiveCalibration(DEFAULT_METER_SETTINGS, "other")).toBe(
      DEFAULT_CALIBRATION_DB.other,
    );
    expect(effectiveCalibration({ ...DEFAULT_METER_SETTINGS, calibrationDb: 110 }, "ios")).toBe(
      110,
    );
    // スクリーンショットの例：基準のアプリが 42dB(A)、この計測の Leq が -79.9dBFS
    expect(calibrationForReference(42, -79.9)).toBeCloseTo(121.9, 6);
    expect(calibrationForReference(42, -200)).toBe(140);
  });

  it("大きさの目安", () => {
    expect(loudnessLevel(25)).toBe("veryQuiet");
    expect(loudnessLevel(60)).toBe("lively");
    expect(loudnessLevel(100)).toBe("veryLoud");
  });
});
