/** 数値の表示（小数 1 桁の dB・周波数） */
import { formatNumber, type Lang } from "~/platform/i18n";

export function formatDb(lang: Lang, db: number): string {
  return formatNumber(lang, db, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function formatHz(lang: Lang, hz: number): string {
  if (hz >= 1000) {
    return `${formatNumber(lang, hz / 1000, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kHz`;
  }
  return `${formatNumber(lang, hz, { maximumFractionDigits: 0 })} Hz`;
}

export function formatPercent(lang: Lang, share: number): string {
  return formatNumber(lang, share, { style: "percent", maximumFractionDigits: 0 });
}

export function formatSeconds(lang: Lang, ms: number): string {
  return formatNumber(lang, ms / 1000, { maximumFractionDigits: 1 });
}
