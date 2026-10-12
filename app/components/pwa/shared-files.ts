/**
 * Service Worker が共有受け取り（share_target）で一時保存したファイルを取り出す。
 * 取り出したらキャッシュごと消す（端末内に残さない）。
 */
import { SHARE_TARGET_CACHE } from "~/lib/pwa";

export async function takeSharedFiles(): Promise<File[]> {
  if (typeof caches === "undefined") return [];
  try {
    if (!(await caches.has(SHARE_TARGET_CACHE))) return [];
    const cache = await caches.open(SHARE_TARGET_CACHE);
    const keys = await cache.keys();
    const files: File[] = [];
    for (const [i, request] of keys.entries()) {
      const response = await cache.match(request);
      if (!response) continue;
      const blob = await response.blob();
      const rawName = response.headers.get("x-file-name");
      let name = `shared-${i + 1}`;
      try {
        if (rawName) name = decodeURIComponent(rawName);
      } catch {
        // 壊れた名前は既定の名前にする
      }
      const lastModified = Number(response.headers.get("x-last-modified")) || Date.now();
      files.push(new File([blob], name, { type: blob.type, lastModified }));
    }
    return files;
  } catch {
    return [];
  } finally {
    try {
      await caches.delete(SHARE_TARGET_CACHE);
    } catch {
      // 何もしない
    }
  }
}

/** PC の Chrome / Edge の file_handlers（launchQueue）の型 */
interface LaunchParams {
  files?: readonly FileSystemFileHandle[];
}
interface LaunchQueue {
  setConsumer(consumer: (params: LaunchParams) => void): void;
}

/** 「このアプリで開く」で渡されたファイルを受け取る。対応していないブラウザでは何もしない */
export function consumeLaunchQueue(onFiles: (files: File[]) => void): void {
  const queue = (window as Window & { launchQueue?: LaunchQueue }).launchQueue;
  if (!queue) return;
  queue.setConsumer((params) => {
    const handles = params.files ?? [];
    if (handles.length === 0) return;
    void Promise.all(handles.map((h) => h.getFile()))
      .then(onFiles)
      .catch(() => {});
  });
}
