/** 計測の設定（時間・補正値・重み付け）の既定値と検証 */
import {
  CALIBRATION_MAX_DB,
  CALIBRATION_MIN_DB,
  DEFAULT_CALIBRATION_DB,
  DEFAULT_DURATION,
  type DevicePlatform,
  DURATIONS,
  type MeasureDuration,
} from "../../../domain/limits";
import {
  FREQUENCY_WEIGHTINGS,
  type FrequencyWeighting,
  TIME_WEIGHTINGS,
  type TimeWeighting,
} from "../../../domain/measurement";

/** 保存する設定の版。2 から補正値の既定値が端末の種類で変わった */
export const SETTINGS_VERSION = 2;
/** 版 1 の補正値の既定値（この値のままなら利用者が選んだ値ではないので、新しい既定値に切り替える） */
const LEGACY_DEFAULT_CALIBRATION_DB = 100;

export interface MeterSettings {
  durationSec: MeasureDuration;
  /** 推定音圧（dB）＝ dBFS ＋ この値。null なら端末の種類ごとの既定値 */
  calibrationDb: number | null;
  frequencyWeighting: FrequencyWeighting;
  timeWeighting: TimeWeighting;
}

export const DEFAULT_METER_SETTINGS: MeterSettings = {
  durationSec: DEFAULT_DURATION,
  calibrationDb: null,
  frequencyWeighting: "A",
  timeWeighting: "fast",
};

/** 実際に使う補正値 */
export function effectiveCalibration(settings: MeterSettings, platform: DevicePlatform): number {
  return settings.calibrationDb ?? DEFAULT_CALIBRATION_DB[platform];
}

/** 範囲に収める（基準に合わせた値をそのまま使えるよう、丸めは 0.1dB 単位） */
export function clampCalibration(value: number): number {
  if (!Number.isFinite(value)) return CALIBRATION_MIN_DB;
  return Math.min(CALIBRATION_MAX_DB, Math.max(CALIBRATION_MIN_DB, Math.round(value * 10) / 10));
}

/**
 * 基準の騒音計の値に合わせる補正値。同じ時間に同じ場所で測った基準の値（dB）と、
 * この計測の dBFS（例：Leq）の差
 */
export function calibrationForReference(referenceDb: number, measuredDbfs: number): number {
  return clampCalibration(referenceDb - measuredDbfs);
}

/** 保存された値を検証する。不正な項目だけ既定値に戻す */
export function validateMeterSettings(value: unknown): MeterSettings {
  const input = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const duration = DURATIONS.find((d) => d === input.durationSec);
  const legacy = input.version !== SETTINGS_VERSION;
  const calibration = input.calibrationDb;
  return {
    durationSec: duration ?? DEFAULT_DURATION,
    calibrationDb:
      typeof calibration === "number" &&
      Number.isFinite(calibration) &&
      !(legacy && calibration === LEGACY_DEFAULT_CALIBRATION_DB)
        ? clampCalibration(calibration)
        : null,
    frequencyWeighting:
      FREQUENCY_WEIGHTINGS.find((w) => w === input.frequencyWeighting) ??
      DEFAULT_METER_SETTINGS.frequencyWeighting,
    timeWeighting:
      TIME_WEIGHTINGS.find((w) => w === input.timeWeighting) ??
      DEFAULT_METER_SETTINGS.timeWeighting,
  };
}
