/** 計測の上限・既定値 */

/** 計測時間の選択肢（秒） */
export const DURATIONS = [5, 10, 30, 60] as const;
export type MeasureDuration = (typeof DURATIONS)[number];
export const DEFAULT_DURATION: MeasureDuration = 10;

/** 1 回の解析の間隔（ミリ秒）。60 秒で 600 フレーム */
export const FRAME_INTERVAL_MS = 100;

/** FFT の点数（スペクトルの表示・周波数の解析用）。48kHz で 1 ビンあたり約 11.7Hz */
export const FFT_SIZE = 4096;

/**
 * 波形を取り出す解析器の長さ（Web Audio の上限）。48kHz で約 0.68 秒分を持ち、
 * 前回から増えた分だけを読むので、読む間隔が多少ずれても音を取りこぼさない
 */
export const WAVEFORM_BUFFER_SIZE = 32768;

/** 計測の始めはフィルタが落ち着いていないので、この長さの音は数えない（秒） */
export const SETTLE_SEC = 0.2;

/** これより小さい音は無音として扱う（dBFS） */
export const SILENCE_DBFS = -100;

/** 補正値の既定値を分ける端末の種類 */
export type DevicePlatform = "ios" | "other";

/**
 * 推定音圧（dB）＝ dBFS ＋ 補正値。端末のマイクは校正されていないので目安。
 * iOS は、機種ごとに校正された市販の騒音計アプリ（dB(A)）と同じ場所で並べて測り、差から決めた値。
 * それ以外（Android・パソコン）は実機と比べていない暫定値
 */
export const DEFAULT_CALIBRATION_DB: Record<DevicePlatform, number> = {
  ios: 122,
  other: 100,
};
export const CALIBRATION_MIN_DB = 60;
export const CALIBRATION_MAX_DB = 140;

/** 主な周波数を探す範囲（Hz）。これより下は空調・風の雑音が多い */
export const PITCH_MIN_HZ = 50;
export const PITCH_MAX_HZ = 8000;
