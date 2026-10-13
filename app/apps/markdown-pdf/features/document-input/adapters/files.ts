/** File・画像 URL・ダウンロード・sessionStorage を扱う部分（DOM に依存する） */
import { useEffect, useState } from "react";
import { createStorage } from "~/platform/storage";
import { imageMimeTypeForFileName } from "../../../domain/limits";

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

/** SVG はサイトのオリジンを継がない data: URL にし、MIME を固定する */
function readSvgUrl(file: File): Promise<string | undefined> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : undefined);
    reader.onerror = () => resolve(undefined);
    reader.onabort = () => resolve(undefined);
    reader.readAsDataURL(new Blob([file], { type: "image/svg+xml" }));
  });
}

/** 画像の一覧から「ファイル名 → URL」を作る。一覧が変われば古い blob: URL を解放する */
export function useObjectUrls(files: readonly File[]): ReadonlyMap<string, string> {
  const [urls, setUrls] = useState<ReadonlyMap<string, string>>(() => new Map());
  useEffect(() => {
    let active = true;
    const created = new Map<string, string>();
    const blobUrls: string[] = [];
    const pending: Promise<void>[] = [];
    for (const file of files) {
      if (/\.svg$/i.test(file.name) || file.type.toLowerCase() === "image/svg+xml") {
        pending.push(
          readSvgUrl(file).then((url) => {
            if (url) created.set(file.name, url);
          }),
        );
      } else {
        const type = imageMimeTypeForFileName(file.name);
        if (!type) continue;
        const url = URL.createObjectURL(new Blob([file], { type }));
        blobUrls.push(url);
        created.set(file.name, url);
      }
    }
    // SVG の読み込みを待つあいだも、それ以外の画像は表示する
    setUrls(new Map(created));
    void Promise.all(pending).then(() => {
      if (active) setUrls(new Map(created));
    });
    return () => {
      active = false;
      for (const url of blobUrls) URL.revokeObjectURL(url);
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
