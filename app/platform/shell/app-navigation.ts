import type { MouseEvent } from "react";

/** SW の制御下からアプリ外へ移るときは、未キャッシュのルートチャンクを読み込まない */
export function handleAppNavigation(event: MouseEvent<HTMLAnchorElement>, appPath: string): void {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.currentTarget.hasAttribute("target") ||
    !navigator.serviceWorker?.controller
  ) {
    return;
  }

  const { href } = event.currentTarget;
  const { pathname } = new URL(href);
  const insideApp = appPath
    ? pathname === `/${appPath}` || pathname.startsWith(`/${appPath}/`)
    : pathname === "/" || pathname === "/en/";
  if (insideApp) return;

  event.preventDefault();
  window.location.assign(href);
}
