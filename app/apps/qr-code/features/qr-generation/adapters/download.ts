/** ファイル保存と blob: URL の管理（DOM はここに閉じ込める）。 */

/** プレビュー用の blob: URL を作る（必ず releaseObjectUrl で解放する） */
export function createObjectUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

/** プレビュー用の blob: URL を解放する（null / undefined は無視） */
export function releaseObjectUrl(url: string | null | undefined): void {
  if (url) URL.revokeObjectURL(url);
}

/**
 * Blob を `<a download>` で保存する。blob: URL はクリック後すぐ `<a>` を外し、
 * SVG（スクリプトを含みうる）は即、それ以外は保存開始を待ってから解放する。
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  anchor.removeAttribute("href");
  const isSvg = blob.type.toLowerCase().startsWith("image/svg");
  setTimeout(() => URL.revokeObjectURL(url), isSvg ? 0 : 10_000);
}
