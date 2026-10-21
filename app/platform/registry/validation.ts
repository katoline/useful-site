import { APP_CATEGORIES, APP_ICON_KEYS, APP_STATUSES, type AppManifest } from "../types.ts";
export const RESERVED_APP_PATHS = [
  "en",
  "assets",
  "privacy",
  "terms",
  "404",
  "sitemap.xml",
  "robots.txt",
  "ads.txt",
  "favicon.ico",
  // サイト共通の OGP 画像（public/og/）
  "og",
] as const;

/** ビルド時と単体テストで登録簿の衝突を検出する。 */
export function validateManifests(manifests: readonly AppManifest[]): void {
  const ids = new Set<string>();
  const paths = new Set<string>();
  for (const manifest of manifests) {
    if (!manifest.id || ids.has(manifest.id))
      throw new Error(`Duplicate or empty app id: ${manifest.id}`);
    if (paths.has(manifest.path)) throw new Error(`Duplicate app path: ${manifest.path}`);
    if (
      manifest.path &&
      (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.path) ||
        (RESERVED_APP_PATHS as readonly string[]).includes(manifest.path))
    )
      throw new Error(`Invalid app path: ${manifest.path}`);
    for (const lang of ["ja", "en"] as const) {
      if (!manifest.name[lang]?.trim() || !manifest.description[lang]?.trim())
        throw new Error(`Missing ${lang} app text: ${manifest.id}`);
      if (manifest.highlights) {
        const highlights = manifest.highlights[lang];
        if (
          !Array.isArray(highlights) ||
          highlights.length === 0 ||
          highlights.some((item) => typeof item !== "string" || !item.trim())
        )
          throw new Error(`Invalid ${lang} app highlights: ${manifest.id}`);
      }
    }
    if (!(APP_CATEGORIES as readonly string[]).includes(manifest.category))
      throw new Error(`Invalid app category: ${manifest.id}`);
    if (!(APP_STATUSES as readonly string[]).includes(manifest.status))
      throw new Error(`Invalid app status: ${manifest.id}`);
    if (!(APP_ICON_KEYS as readonly string[]).includes(manifest.icon))
      throw new Error(`Invalid app icon: ${manifest.id}`);
    ids.add(manifest.id);
    paths.add(manifest.path);
  }
}
