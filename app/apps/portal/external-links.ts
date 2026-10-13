import type { Lang } from "../../platform/i18n/langs";
import type { AppCategory, AppIconKey, AppStatus } from "../../platform/types";
export interface ExternalLink {
  id: string;
  url: string;
  name: Record<Lang, string>;
  description: Record<Lang, string>;
  category: AppCategory;
  icon: AppIconKey;
  status: AppStatus;
  order: number;
}
/** 外部システムを追加するときはここに日英の紹介を置く。 */
export const externalLinks: readonly ExternalLink[] = [];
