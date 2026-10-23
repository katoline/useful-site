/** 計測の上限・既定値 */

/** 計測時間の選択肢（秒） */
export const DURATIONS = [5, 10, 30, 60] as const;
export type MeasureDuration = (typeof DURATIONS)[number];
export const DEFAULT_DURATION: MeasureDuration = 10;

/** 1 回の解析の間隔（ミリ秒）。60 秒で 600 フレーム */
export const FRAME_INTERVAL_MS = 100;

/** FFT の点数。48kHz で 1 ビンあたり約 11.7Hz */
export const FFT_SIZE = 4096;

/** これより小さい音は無音として扱う（dBFS） */
export const SILENCE_DBFS = -100;

/**
 * 推定音圧（dB）＝ dBFS ＋ 補正値。端末のマイクは校正されていないので目安。
 * 既定値はスマートフォンの内蔵マイクでおおよそ合う値
 */
export const DEFAULT_CALIBRATION_DB = 100;
export const CALIBRATION_MIN_DB = 60;
export const CALIBRATION_MAX_DB = 140;

/** 主な周波数を探す範囲（Hz）。これより下は空調・風の雑音が多い */
export const PITCH_MIN_HZ = 50;
export const PITCH_MAX_HZ = 8000;
