/**
 * 小さな i18n：辞書・t()・言語の Context・URL との対応。
 * 言語は URL から決まる（ja は接頭辞なし、en は /en）。root.tsx が I18nProvider で配る。
 */
import { createContext, createElement, type ReactNode, useContext, useMemo } from "react";
import { createAppPaths, parsePath } from "../paths";
import { en } from "./en";
import { ja } from "./ja";
import { DEFAULT_LANG, type Lang } from "./langs";
import type { Dictionary, DictKey, TranslateVars } from "./types";

export * from "./langs";
export type { Dictionary, DictKey, TranslateVars } from "./types";

export const dictionaries: Record<Lang, Dictionary> = { ja, en };

/** BCP 47 の言語タグ（Intl・og:locale 用） */
export const LOCALE: Record<Lang, string> = { ja: "ja-JP", en: "en-US" };
export const OG_LOCALE: Record<Lang, string> = { ja: "ja_JP", en: "en_US" };

export function lookup(dict: unknown, key: string): string | undefined {
  let node: unknown = dict;
  for (const part of key.split(".")) {
    if (node && typeof node === "object" && part in node) {
      node = (node as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof node === "string" ? node : undefined;
}

/** 辞書を引く。見つからなければ既定言語、それも無ければキーを返す */
export function translate(lang: Lang, key: DictKey, vars?: TranslateVars): string {
  const raw = lookup(dictionaries[lang], key) ?? lookup(dictionaries[DEFAULT_LANG], key) ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m));
}

export type TFunction = (key: DictKey, vars?: TranslateVars) => string;

export function createT(lang: Lang): TFunction {
  return (key, vars) => translate(lang, key, vars);
}

/** 数値の表示（例 1,234） */
export function formatNumber(lang: Lang, value: number, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(LOCALE[lang], options).format(value);
}

/** バイト数を KB / MB で表示 */
export function formatBytes(lang: Lang, bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const digits = unit === 0 ? 0 : value < 10 ? 1 : 0;
  return `${formatNumber(lang, value, { maximumFractionDigits: digits })} ${units[unit]}`;
}

interface I18nValue {
  lang: Lang;
  t: TFunction;
  dict: Dictionary;
}

const I18nContext = createContext<I18nValue>({
  lang: DEFAULT_LANG,
  t: createT(DEFAULT_LANG),
  dict: dictionaries[DEFAULT_LANG],
});

export function I18nProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  const value = useMemo(() => ({ lang, t: createT(lang), dict: dictionaries[lang] }), [lang]);
  return createElement(I18nContext.Provider, { value }, children);
}

/** 現在の言語と t() */
export function useI18n(): I18nValue {
  return useContext(I18nContext);
}

export function useLang(): Lang {
  return useContext(I18nContext).lang;
}

export { switchLangPath } from "../paths";
export function splitLangPath(pathname: string): { lang: Lang; page: string } {
  const { lang, page } = parsePath(pathname);
  return { lang, page };
}
export function langFromPathname(pathname: string): Lang {
  return parsePath(pathname).lang;
}
export const localizedPath = createAppPaths("").localizedPath;
