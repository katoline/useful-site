import type { Lang } from "./i18n/langs";

export const APP_STATUSES = ["public", "beta", "hidden"] as const;
export type AppStatus = (typeof APP_STATUSES)[number];
export const APP_CATEGORIES = ["image", "document", "other"] as const;
export type AppCategory = (typeof APP_CATEGORIES)[number];
export const APP_ICON_KEYS = [
  "image",
  "file-text",
  "wrench",
  "grid",
  "qr-code",
  "audio-lines",
  "gauge",
] as const;
export type AppIconKey = (typeof APP_ICON_KEYS)[number];

export interface AppManifest {
  id: string;
  path: string;
  name: Record<Lang, string>;
  description: Record<Lang, string>;
  /** ポータルのカードに出す「できること」。各言語 2〜4 個の短い語句。 */
  highlights?: Record<Lang, string[]>;
  category: AppCategory;
  status: AppStatus;
  icon: AppIconKey;
  order?: number;
  menu: { page: string; label: Record<Lang, string> }[];
}
