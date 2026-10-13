/** 表示中の広告枠の上限は配置側の取り決め。開発時の確認にだけ使う。 */
import { MAX_ADS_PER_PAGE } from "./config";

export function warnIfTooManyAdSlots(element: HTMLElement): void {
  const slots = [
    ...element.ownerDocument.querySelectorAll<HTMLElement>("aside[data-ad-format]"),
  ].filter((slot) => slot.getClientRects().length > 0);
  if (slots.length > MAX_ADS_PER_PAGE) {
    console.warn(
      `広告枠が 1 ページの上限（${MAX_ADS_PER_PAGE}）を超えています。配置を見直してください`,
    );
  }
}
