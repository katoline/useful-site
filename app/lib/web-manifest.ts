/**
 * PWA マニフェスト（日英別ファイル。plan.md §6.1）。vite.config.ts のプラグインがビルド時に
 * BASE_PATH 直下へ manifest.<lang>.webmanifest として書き出し、dev でも同じ URL で返す。
 * id は日英共通にして、どちらの言語でインストールしても同じアプリとして扱わせる。
 */
import { en } from "../i18n/en.ts";
import { ja } from "../i18n/ja.ts";
import { LANGS, type Lang, localizedPath } from "../i18n/langs.ts";
import { THEME_COLORS } from "../theme/theme.ts";
import { BASE_PATH } from "./config.ts";
import {
  ACCEPTED_FILE_TYPES,
  manifestFileName,
  SHARE_TARGET_FIELD,
  SHARE_TARGET_PATH,
} from "./pwa.ts";

const DICTS = { ja, en } as const;

/** BASE_PATH からの相対パスを、サイト内の絶対パスにする（ファイル用。末尾スラッシュを付けない） */
const asset = (file: string) => `${BASE_PATH}/${file}`;

export function buildWebManifest(lang: Lang) {
  const t = DICTS[lang].pwa.manifest;
  const startUrl = `${BASE_PATH}${localizedPath(lang, "")}`;
  return {
    id: `${BASE_PATH}/`,
    name: t.name,
    short_name: t.shortName,
    description: t.description,
    lang,
    dir: "ltr",
    start_url: startUrl,
    scope: `${BASE_PATH}/`,
    display: "standalone",
    background_color: THEME_COLORS.light,
    theme_color: THEME_COLORS.light,
    categories: ["photo", "utilities", "productivity"],
    icons: [
      { src: asset("pwa/icon-192.png"), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: asset("pwa/icon-512.png"), sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: asset("pwa/icon-maskable-512.png"),
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    // Android の「共有」から画像・ZIP を受け取る。SW（sw/sw.ts）が受けて変換画面に渡す
    share_target: {
      action: lang === "ja" ? SHARE_TARGET_PATH : `${SHARE_TARGET_PATH}?lang=${lang}`,
      method: "POST",
      enctype: "multipart/form-data",
      params: {
        files: [{ name: SHARE_TARGET_FIELD, accept: ["image/*", ".zip", "application/zip"] }],
      },
    },
    // PC の Chrome / Edge で「このアプリで開く」。ページ側は launchQueue で受け取る
    file_handlers: [{ action: startUrl, accept: ACCEPTED_FILE_TYPES }],
  };
}

/** すべての言語のマニフェスト（ファイル名 → JSON 文字列） */
export function buildWebManifestFiles(): Record<string, string> {
  return Object.fromEntries(
    LANGS.map((lang) => [
      manifestFileName(lang),
      `${JSON.stringify(buildWebManifest(lang), null, 2)}\n`,
    ]),
  );
}
