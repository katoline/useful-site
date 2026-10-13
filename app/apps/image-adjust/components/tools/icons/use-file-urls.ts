import { useEffect, useState } from "react";
import type { IconFile } from "~/apps/image-adjust/lib/icons/zip";

/**
 * 生成した PNG のプレビュー用 Blob URL（ファイル名 → URL）。差し替え・アンマウントで解放する。
 * PNG だけにする：favicon.svg 等の SVG の blob: URL はこのサイトのオリジンを受け継ぎ、
 * 新しいタブで開かれると SVG 内のスクリプトが動くため、作らない（ZIP のダウンロードは問題ない）。
 */
export function useFileUrls(files: readonly IconFile[] | null): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!files) {
      setUrls({});
      return;
    }
    const next: Record<string, string> = {};
    for (const file of files) {
      if (file.type !== "image/png") continue;
      next[file.name] = URL.createObjectURL(
        new Blob([file.data as Uint8Array<ArrayBuffer>], { type: file.type }),
      );
    }
    setUrls(next);
    return () => {
      for (const url of Object.values(next)) URL.revokeObjectURL(url);
    };
  }, [files]);
  return urls;
}
