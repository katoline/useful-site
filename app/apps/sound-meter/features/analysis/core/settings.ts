/** 計測の設定（時間・補正値）の既定値と検証 */
import {
  CALIBRATION_MAX_DB,
  CALIBRATION_MIN_DB,
  DEFAULT_CALIBRATION_DB,
  DEFAULT_DURATION,
  DURATIONS,
  type MeasureDuration,
} from "../../../domain/limits";

export interface MeterSettings {
  durationSec: MeasureDuration;
  /** 推定音圧（dB）＝ dBFS ＋ この値 */
  calibrationDb: number;
}

export const DEFAULT_METER_SETTINGS: MeterSettings = {
  durationSec: DEFAULT_DURATION,
  calibrationDb: DEFAULT_CALIBRATION_DB,
};

export function clampCalibration(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_CALIBRATION_DB;
  return Math.min(CALIBRATION_MAX_DB, Math.max(CALIBRATION_MIN_DB, Math.round(value)));
}

/** 保存された値を検証する。不正な項目だけ既定値に戻す */
export function validateMeterSettings(value: unknown): MeterSettings {
  const input = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const duration = DURATIONS.find((d) => d === input.durationSec);
  return {
    durationSec: duration ?? DEFAULT_DURATION,
    calibrationDb:
      typeof input.calibrationDb === "number"
        ? clampCalibration(input.calibrationDb)
        : DEFAULT_CALIBRATION_DB,
  };
}
