/** 端末の種類（補正値の既定値を選ぶ）。iPadOS は Mac と同じ UA を名乗るので、タッチの有無で見分ける */
import type { DevicePlatform } from "../../../domain/limits";

export function detectPlatform(): DevicePlatform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return "ios";
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return "ios";
  return "other";
}
