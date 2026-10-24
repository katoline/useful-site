/** 数値の表示（速度は 100 以上なら整数、それ未満は小数 1 桁。時間は整数の ms） */
import { formatNumber, type Lang } from "~/platform/i18n";

export function formatMbps(lang: Lang, mbps: number): string {
  const digits = mbps >= 100 ? 0 : 1;
  return formatNumber(lang, mbps, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatMs(lang: Lang, ms: number): string {
  return formatNumber(lang, ms, { maximumFractionDigits: ms < 10 ? 1 : 0 });
}

export function formatDateTime(lang: Lang, iso: string): string {
  return new Intl.DateTimeFormat(lang === "ja" ? "ja-JP" : "en-US", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}
