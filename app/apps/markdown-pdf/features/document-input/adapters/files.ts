/** File・Blob URL・ダウンロード・sessionStorage を扱う部分（DOM に依存する） */
import { useEffect, useState } from "react";
import { createStorage } from "~/platform/storage";

export function readTextFile(file: File): Promise<string> {
  return file.text();
}

/** 文字列をファイルとして保存させる（a[download]） */
export function downloadText(fileName: string, text: string, type = "text/markdown"): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // クリック直後に消すと保存が始まらないブラウザがあるので少し待つ
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** 画像ファイルの一覧から「ファイル名 → blob: URL」を作る。一覧が変われば古い URL を解放する */
export function useObjectUrls(files: readonly File[]): ReadonlyMap<string, string> {
  const [urls, setUrls] = useState<ReadonlyMap<string, string>>(() => new Map());
  useEffect(() => {
    const created = new Map(files.map((file) => [file.name, URL.createObjectURL(file)] as const));
    setUrls(created);
    return () => {
      for (const url of created.values()) URL.revokeObjectURL(url);
    };
  }, [files]);
  return urls;
}

const sessionStore = createStorage("markdown-pdf:", "session");
const DRAFT_KEY = "draft";

/** 編集中のテキストを sessionStorage に置く（再読み込みで消えないように。タブを閉じれば消える） */
export const draftStorage = {
  load(): string | null {
    return sessionStore.getItem(DRAFT_KEY);
  },
  save(text: string): void {
    if (text) sessionStore.setItem(DRAFT_KEY, text);
    else sessionStore.removeItem(DRAFT_KEY);
  },
};
