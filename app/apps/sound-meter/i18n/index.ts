/** このアプリの文言。言語は platform の I18nProvider（URL から決まる）に従う */
import { useMemo } from "react";
import { type Lang, useLang } from "~/platform/i18n";
import { en } from "./en";
import { ja } from "./ja";
import type { Dictionary, DictKey, TranslateVars } from "./types";

export type { Dictionary, DictKey, TranslateVars } from "./types";
export const dictionaries: Record<Lang, Dictionary> = { ja, en };

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
  const raw = lookup(dictionaries[lang], key) ?? lookup(ja, key) ?? key;
  return vars
    ? raw.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m))
    : raw;
}

export type TFunction = (key: DictKey, vars?: TranslateVars) => string;
export function createT(lang: Lang): TFunction {
  return (key, vars) => translate(lang, key, vars);
}

export function useSoundI18n(): { lang: Lang; t: TFunction } {
  const lang = useLang();
  return useMemo(() => ({ lang, t: createT(lang) }), [lang]);
}
