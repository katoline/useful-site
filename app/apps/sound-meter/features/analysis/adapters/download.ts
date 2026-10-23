/** 文字列をファイルとして保存させる */
export function downloadText(fileName: string, text: string, type: string): void {
  // Excel が UTF-8 と判断できるよう BOM を付ける
  const url = URL.createObjectURL(new Blob(["﻿", text], { type: `${type};charset=utf-8` }));
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
