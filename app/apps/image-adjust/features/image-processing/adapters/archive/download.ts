/**
 * 保存まわり：Blob のダウンロード、File System Access API（ZIP のストリーム書き込み）、
 * Web Share API（スマホで「共有 → 画像を保存」。§6.2）。
 */

interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: { description?: string; accept: Record<string, string[]> }[];
}
interface FileSystemFileHandleLike {
  createWritable(): Promise<WritableStream<Uint8Array>>;
}
type ShowSaveFilePicker = (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandleLike>;

function savePicker(): ShowSaveFilePicker | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { showSaveFilePicker?: ShowSaveFilePicker }).showSaveFilePicker;
}

/**
 * Blob を <a download> でダウンロードする。
 * blob: URL はこのページのオリジンを受け継ぐので、<a> はクリックしたらすぐ DOM から外し、URL も revoke する。
 * SVG（スクリプトを含みうる）は次のタスクで即 revoke、それ以外はダウンロード開始を待って少し遅らせる
 * （一部ブラウザは click 直後に revoke すると保存に失敗する）。
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  a.removeAttribute("href");
  const isSvg = blob.type.toLowerCase().startsWith("image/svg");
  setTimeout(() => URL.revokeObjectURL(url), isSvg ? 0 : 10_000);
}

/**
 * File System Access API が使えるか（PC の Chrome / Edge）。
 * 自動テスト（webdriver）ではファイル選択ダイアログを操作できないので使わない。
 */
export function canUseFileSystemAccess(): boolean {
  if (typeof navigator === "undefined") return false;
  if (navigator.webdriver) return false;
  return typeof savePicker() === "function";
}

/** ZIP の保存先を選ばせて書き込み先を返す。キャンセルなら null */
export async function pickZipWritable(
  suggestedName: string,
): Promise<WritableStream<Uint8Array> | null> {
  const picker = savePicker();
  if (!picker) return null;
  try {
    const handle = await picker({
      suggestedName,
      types: [{ description: "ZIP", accept: { "application/zip": [".zip"] } }],
    });
    return await handle.createWritable();
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return null;
    throw e;
  }
}

/** Web Share API でファイルを共有できるか */
export function canShareFiles(files: File[]): boolean {
  if (typeof navigator === "undefined" || typeof navigator.canShare !== "function") return false;
  try {
    return navigator.canShare({ files });
  } catch {
    return false;
  }
}

/** 共有シートを開く。利用者がキャンセルしたら false */
export async function shareFiles(files: File[], title?: string): Promise<boolean> {
  try {
    await navigator.share({ files, title });
    return true;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return false;
    throw e;
  }
}
