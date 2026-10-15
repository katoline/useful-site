/**
 * qr-generation：URL から QR の SVG / PNG を作り、保存する機能。
 * feature の外からはここだけを import する。ページ・SettingsPanel が使う API に絞る。
 *
 * 使い方の流れ（ページ側）:
 * 1. `validateQrUrl(input)` で URL を検証する（http/https・1000 UTF-8 バイト）。
 *    検証は正規化した値で行えるが、QR に符号化するのは入力そのもの（前後の空白だけ除く）。
 * 2. `validateQrSettings(value)` で設定（色・PNG サイズ・アイコンサイズ）を正す。
 * 3. アイコンは `{ kind: "none" }` / `{ kind: "svg", svg }`（信頼済み固定 SVG）/
 *    `{ kind: "png", dataUrl }`（Canvas で変換済み PNG）のいずれかを渡す。
 * 4. `generateQrSvg(url, settings, icon)` で SVG（`svg` と `svgBlob`）を得る。
 * 5. `evaluateReadability({ moduleCount, pngSize })` で保存可否を判断し、
 *    足りなければ `minPngSize` を案内する。
 * 6. `renderPngBlob(svg, settings.pngSize)` で PNG Blob を作り、
 *    `downloadBlob(blob, qrFileName(host, "png"))` で保存する。
 * 7. プレビューの blob: URL は `createObjectUrl` / `releaseObjectUrl` で解放する。
 */

export type { PngSize, QrSettings } from "../../domain/qr-settings";
export {
  DEFAULT_QR_SETTINGS,
  ICON_SIZE_PERCENT_MAX,
  ICON_SIZE_PERCENT_MIN,
  MAX_URL_BYTES,
  PNG_SIZES,
  QR_FOREGROUND_PRESETS,
} from "../../domain/qr-settings";
export { createObjectUrl, downloadBlob, releaseObjectUrl } from "./adapters/download";
export type { GeneratedQr } from "./adapters/generate";
export { generateQrSvg } from "./adapters/generate";
export { renderPngBlob } from "./adapters/render-png";
export { evaluateForegroundColor, formatHexColor } from "./core/color";
export { qrFileName } from "./core/file-name";
export { evaluateReadability } from "./core/readability";
export { validateQrSettings } from "./core/settings";
export { validateQrUrl } from "./core/url";
