/**
 * OGP 画像（1200×630）の置き場所の規約と、アプリごとの有無の判定。
 *
 * - アプリ：app/apps/<id>/public/og/<lang>.png（/<アプリ>/og/<lang>.png で配信）
 * - サイト共通（ポータル・規約類・404）：public/og/<lang>.png（/og/<lang>.png で配信）
 *
 * buildPageMeta()（app/platform/seo/meta.ts）は、そのページのアプリの画像が日英とも揃っていればそれを、
 * 無ければサイト共通の画像を使う。有無はビルド時にこのファイルで調べ、仮想モジュール
 * （virtual:app-og-images）で渡す（platform からアプリのフォルダを import しないため）。
 *
 * Node の型除去で直接実行する（vite.config.ts・vitest.config.ts・scripts/generate-og-images.ts から）ので、
 * 依存には拡張子付きの相対 import を使う。
 */
import { access } from "node:fs/promises";
import path from "node:path";
import { loadAppManifests } from "./apps.ts";

export type { AppEntry } from "./apps.ts";
export { loadAppManifests as loadApps } from "./apps.ts";

export const OG_LANGS = ["ja", "en"] as const;

/** アプリ（manifest.path が空でないもの）の OGP 画像のファイル */
export function appOgImageFile(appDir: string, lang: string): string {
  return path.join(appDir, "public", "og", `${lang}.png`);
}

/** サイト共通の OGP 画像のファイル */
export function siteOgImageFile(root: string, lang: string): string {
  return path.join(root, "public", "og", `${lang}.png`);
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

/** 日英の OGP 画像が揃っているアプリの manifest.path（ポータルは含めない） */
export async function findAppOgImagePaths(root: string): Promise<string[]> {
  const result: string[] = [];
  for (const { dir, manifest } of await loadAppManifests(root)) {
    if (!manifest.path) continue;
    const files = OG_LANGS.map((lang) => appOgImageFile(dir, lang));
    if ((await Promise.all(files.map(exists))).every(Boolean)) result.push(manifest.path);
  }
  return result.sort();
}
