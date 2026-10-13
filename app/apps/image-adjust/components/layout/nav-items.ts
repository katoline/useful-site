import type { DictKey } from "~/apps/image-adjust/i18n";

/** ヘッダーのツールへのリンク（page は言語に依存しないパス） */
export const NAV_ITEMS: { page: string; label: DictKey }[] = [
  { page: "", label: "nav.convert" },
  { page: "icons", label: "nav.icons" },
  { page: "guide", label: "nav.guide" },
];

/** フッターのリンク */
export const FOOTER_ITEMS: { page: string; label: DictKey }[] = [
  { page: "about", label: "footer.about" },
];
