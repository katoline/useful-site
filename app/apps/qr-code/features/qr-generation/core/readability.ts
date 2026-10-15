/**
 * 出力が読み取りに足る解像度かを判定する純粋関数。
 * 1 モジュールあたりの画素数が基準未満なら、その PNG サイズでは保存させない。
 */
import {
  MIN_PIXELS_PER_MODULE,
  PNG_SIZES,
  type PngSize,
  QR_QUIET_ZONE_MODULES,
} from "../../../domain/qr-settings";

export interface ReadabilityInput {
  /** 余白を含まないモジュール数 */
  moduleCount: number;
  /** 出力しようとしている PNG の一辺（px） */
  pngSize: number;
  quietZone?: number;
}

export interface ReadabilityResult {
  /** この PNG サイズで保存してよいか */
  ok: boolean;
  /** 1 モジュールあたりの画素数 */
  modulePixels: number;
  /** 基準を満たすために必要なおおよその画素数 */
  requiredPixels: number;
  /** 基準を満たす最小の PNG サイズ（上限でも足りなければ null） */
  minPngSize: PngSize | null;
}

/** モジュール数と出力サイズから読み取り可能性を評価する */
export function evaluateReadability({
  moduleCount,
  pngSize,
  quietZone = QR_QUIET_ZONE_MODULES,
}: ReadabilityInput): ReadabilityResult {
  const extent = Math.max(1, moduleCount + quietZone * 2);
  const requiredPixels = Math.ceil(extent * MIN_PIXELS_PER_MODULE);
  const minPngSize = PNG_SIZES.find((size) => size >= requiredPixels) ?? null;
  const modulePixels = pngSize / extent;
  return {
    ok: modulePixels >= MIN_PIXELS_PER_MODULE,
    modulePixels,
    requiredPixels,
    minPngSize,
  };
}
