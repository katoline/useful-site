/** 計測の用語と型。音の大きさは dBFS（デジタルの最大値を 0 とする値）で持ち、表示の時に補正値を足す */

/** 周波数の帯域（Hz） */
export interface Band {
  id: BandId;
  minHz: number;
  maxHz: number;
}

export const BANDS = [
  { id: "low", minHz: 20, maxHz: 250 },
  { id: "lowMid", minHz: 250, maxHz: 1000 },
  { id: "highMid", minHz: 1000, maxHz: 4000 },
  { id: "high", minHz: 4000, maxHz: 16000 },
] as const satisfies readonly { id: string; minHz: number; maxHz: number }[];
export type BandId = (typeof BANDS)[number]["id"];

/** 1 回（FRAME_INTERVAL_MS ごと）の解析結果 */
export interface FrameAnalysis {
  /** 経過時間（ミリ秒） */
  timeMs: number;
  /** 実効値のレベル（周波数の重み付けなし。dBFS） */
  levelDbfs: number;
  /** A 特性（人の聞こえ方に近い重み付け）のレベル（dBFS） */
  levelADbfs: number;
  /** 瞬間の最大値（dBFS） */
  peakDbfs: number;
  /** いちばん強い周波数（Hz）。無音なら null */
  dominantHz: number | null;
  /** スペクトル重心（音の明るさの目安。Hz）。無音なら null */
  centroidHz: number | null;
  /** 帯域ごとのエネルギーの割合（合計 1。無音ならすべて 0） */
  bandShares: Record<BandId, number>;
}

/** 計測の集計 */
export interface MeasurementSummary {
  durationMs: number;
  frames: number;
  /** 完全な無音を除いた回数（0 なら音を受け取れていない） */
  audibleFrames: number;
  /** 等価騒音レベル（エネルギーの平均。A 特性。dBFS） */
  leqDbfs: number;
  /** 最大・最小（A 特性。dBFS） */
  maxDbfs: number;
  minDbfs: number;
  /** 時間率騒音レベル：L10（大きい方から 10% の値）・L50（中央値）・L90（暗騒音の目安） */
  l10Dbfs: number;
  l50Dbfs: number;
  l90Dbfs: number;
  /** 瞬間の最大値（dBFS） */
  peakDbfs: number;
  /** 計測中に最も多く現れた主な周波数（Hz）。決まらなければ null */
  dominantHz: number | null;
  /** スペクトル重心の平均（Hz） */
  centroidHz: number | null;
  /** 帯域ごとのエネルギーの割合（計測全体） */
  bandShares: Record<BandId, number>;
}

/** 推定音圧（dB）による大きさの目安。上限（未満）の昇順 */
export const LOUDNESS_LEVELS = [
  { id: "veryQuiet", below: 30 },
  { id: "quiet", below: 45 },
  { id: "moderate", below: 60 },
  { id: "lively", below: 70 },
  { id: "loud", below: 85 },
  { id: "veryLoud", below: Number.POSITIVE_INFINITY },
] as const;
export type LoudnessLevel = (typeof LOUDNESS_LEVELS)[number]["id"];

export function loudnessLevel(db: number): LoudnessLevel {
  return (LOUDNESS_LEVELS.find((level) => db < level.below) ?? LOUDNESS_LEVELS[5]).id;
}
