/**
 * アプリの外から届いたファイル（PWA の共有受け取り・ファイルの関連付け）を、
 * 変換・圧縮ツールへ渡すための受け渡し口。
 * 送る側（PWA）は pushIncomingFiles()、受け取る側（ツール画面）は subscribeIncomingFiles() を使う。
 */

type Listener = (files: File[]) => void;

let pending: File[] = [];
const listeners = new Set<Listener>();

/** 届いたファイルを渡す。受け取り側がまだ無ければ、購読されるまで保持する */
export function pushIncomingFiles(files: File[]): void {
  if (files.length === 0) return;
  if (listeners.size === 0) {
    pending = [...pending, ...files];
    return;
  }
  for (const listener of listeners) listener(files);
}

/** 届いたファイルを受け取る。保持中のものがあれば購読した時点で渡す。戻り値で購読を解除する */
export function subscribeIncomingFiles(listener: Listener): () => void {
  listeners.add(listener);
  if (pending.length > 0) {
    const files = pending;
    pending = [];
    listener(files);
  }
  return () => {
    listeners.delete(listener);
  };
}
