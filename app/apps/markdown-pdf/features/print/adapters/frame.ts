/**
 * プレビューの iframe を扱う（DOM に依存する）。
 *
 * iframe は sandbox="allow-same-origin allow-modals"（スクリプトは動かない）。親のページから
 * 同一オリジンとして中身を触れるので、印刷・スクロール位置・リンクのクリックは親が受け持つ。
 */

/** プレビューの iframe の sandbox。allow-scripts は付けない（docs/markdown-pdf-plan.md §5） */
export const PREVIEW_SANDBOX = "allow-same-origin allow-modals";

const OPENABLE_SCHEMES = new Set(["http:", "https:", "mailto:", "tel:"]);

/**
 * iframe の中身だけを印刷する（印刷ダイアログで「PDF に保存」を選んでもらう）。
 * 印刷中は文書のタイトルを保存名の初期値にする。印刷できなければ false
 */
export function printFrame(iframe: HTMLIFrameElement, title: string): boolean {
  const win = iframe.contentWindow;
  const doc = iframe.contentDocument;
  if (!win || !doc) return false;
  const previous = doc.title;
  doc.title = title;
  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    doc.title = previous;
  };
  // print() はダイアログを閉じるまで戻らないブラウザが多いが、すぐ戻るもの（モバイル等）もあるので
  // afterprint で戻す
  win.addEventListener("afterprint", restore, { once: true });
  win.focus();
  win.print();
  return true;
}

/**
 * iframe の中のリンクのクリックを親で扱う。sandbox に allow-popups が無いので target="_blank" は
 * そのままでは開かない。また srcdoc の文書の基底 URL は親のページなので、#… のリンクが iframe を
 * 親のページへ遷移させてしまう。ページ内リンクは中でスクロールし、外部リンクは親から新しいタブで開く
 */
export function handleFrameLinks(iframe: HTMLIFrameElement): () => void {
  const doc = iframe.contentDocument;
  if (!doc) return () => {};
  const onClick = (event: MouseEvent) => {
    const target = event.target as { closest?: (selector: string) => Element | null } | null;
    const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null | undefined;
    if (!anchor) return;
    event.preventDefault();
    const href = anchor.getAttribute("href") ?? "";
    if (href.startsWith("#")) {
      let id = href.slice(1);
      try {
        id = decodeURIComponent(id);
      } catch {
        // そのまま使う
      }
      doc.getElementById(id)?.scrollIntoView();
      return;
    }
    let url: URL;
    try {
      url = new URL(href);
    } catch {
      return;
    }
    if (OPENABLE_SCHEMES.has(url.protocol)) window.open(url.href, "_blank", "noopener,noreferrer");
  };
  doc.addEventListener("click", onClick);
  return () => doc.removeEventListener("click", onClick);
}

/** iframe のスクロール位置（読み込み直しても位置を保つため） */
export function frameScrollY(iframe: HTMLIFrameElement): number {
  return iframe.contentWindow?.scrollY ?? 0;
}

export function restoreFrameScroll(iframe: HTMLIFrameElement, y: number): void {
  iframe.contentWindow?.scrollTo(0, y);
}
