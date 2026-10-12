import { serializeJsonLd } from "./json-ld";

/**
 * 本文中に JSON-LD を置く（React は <script> の子の文字列をエスケープせずに出す。
 * serializeJsonLd が < > & を \uXXXX にするので </script> で抜け出せない）。
 * <head> に出すなら buildPageMeta の jsonLd を使う */
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json">{serializeJsonLd(data)}</script>;
}
