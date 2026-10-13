/** 対応言語と URL の対応（React に依存しない。react-router.config.ts からも使う） */
export const LANGS = ["ja", "en"] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = "ja";

/** 言語ごとの URL 接頭辞（BASE_PATH からの相対）。既定言語は接頭辞なし */
export const LANG_PREFIX: Record<Lang, string> = { ja: "", en: "en" };

export function isLang(value: unknown): value is Lang {
  return typeof value === "string" && (LANGS as readonly string[]).includes(value);
}
