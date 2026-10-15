import type { ja } from "./ja.ts";

/** リテラル型を string に広げた辞書の型（en はこの型を満たす必要がある） */
type Widen<T> = T extends string ? string : { readonly [K in keyof T]: Widen<T[K]> };
export type Dictionary = Widen<typeof ja>;

/** "url.label" のようなドット区切りのキー（葉だけ） */
type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];
export type DictKey = Leaves<Dictionary>;
export type TranslateVars = Record<string, string | number>;
