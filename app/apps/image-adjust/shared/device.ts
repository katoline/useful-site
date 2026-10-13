/**
 * 端末の判定（PC かスマホか）。ブラウザの navigator を読むのでここに置く。
 * 上限の値と計算は domain/limits.ts。
 */
import { type DeviceClass, type Limits, limitsFor, workerCount } from "../domain/limits";

export interface DeviceHints {
  /** navigator.deviceMemory（GB。Chrome 系のみ） */
  deviceMemory?: number;
  userAgent?: string;
  hardwareConcurrency?: number;
  /** navigator.maxTouchPoints */
  maxTouchPoints?: number;
}

const MOBILE_UA = /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|Opera Mini|IEMobile/i;

function readNavigatorHints(): DeviceHints {
  if (typeof navigator === "undefined") return {};
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    deviceMemory: nav.deviceMemory,
    userAgent: nav.userAgent,
    hardwareConcurrency: nav.hardwareConcurrency,
    maxTouchPoints: nav.maxTouchPoints,
  };
}

/**
 * PC かスマホかの判定。deviceMemory が取れればそれで決め（4GB 以下はスマホ相当）、
 * 取れない端末（iOS Safari 等）は UA で判定する。
 */
export function detectDeviceClass(hints: DeviceHints = readNavigatorHints()): DeviceClass {
  if (typeof hints.deviceMemory === "number") {
    return hints.deviceMemory <= 4 ? "mobile" : "desktop";
  }
  if (hints.userAgent && MOBILE_UA.test(hints.userAgent)) return "mobile";
  // iPadOS 13 以降は Macintosh を名乗るので、タッチ対応の Mac はスマホ相当にする
  if (hints.userAgent && /Macintosh/.test(hints.userAgent) && (hints.maxTouchPoints ?? 0) > 1) {
    return "mobile";
  }
  return "desktop";
}

/** 今の端末の上限 */
export function currentLimits(): Limits {
  return limitsFor(detectDeviceClass());
}

/** 今の端末の Web Worker の数 */
export function currentWorkerCount(): number {
  return workerCount(detectDeviceClass(), readNavigatorHints().hardwareConcurrency);
}
