import { useMemo } from "react";
import { dictionaries as platformDictionaries, useLang } from "~/platform/i18n";
import { en } from "./en";
import { ja } from "./ja";
import { DEFAULT_LANG, type Lang } from "./langs";
import type { Dictionary, DictKey, TranslateVars } from "./types";

export { formatBytes, formatNumber, LOCALE, OG_LOCALE, useLang } from "~/platform/i18n";
export * from "./langs";
export type { Dictionary, DictKey, TranslateVars } from "./types";
export const dictionaries = { ja, en };
function lookup(dict: unknown, key: string): string | undefined {
  let node = dict;
  for (const part of key.split(".")) {
    if (node && typeof node === "object" && part in node)
      node = (node as Record<string, unknown>)[part];
    else return undefined;
  }
  return typeof node === "string" ? node : undefined;
}
export function translate(lang: Lang, key: DictKey, vars?: TranslateVars): string {
  const raw =
    lookup(dictionaries[lang], key) ??
    lookup(platformDictionaries[lang], key) ??
    lookup(dictionaries[DEFAULT_LANG], key) ??
    key;
  return vars
    ? raw.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m))
    : raw;
}
export type TFunction = (key: DictKey, vars?: TranslateVars) => string;
export function createT(lang: Lang): TFunction {
  return (key, vars) => translate(lang, key, vars);
}
export function useI18n(): { lang: Lang; t: TFunction; dict: Dictionary } {
  const lang = useLang();
  return useMemo(() => ({ lang, t: createT(lang), dict: dictionaries[lang] }), [lang]);
}
