/**
 * PWA（Service Worker・マニフェスト・共有受け取り）の定数。
 * Service Worker（sw/sw.ts）・ページ側（features/pwa/）・ビルド（build/postbuild.ts）で共有する。
 * React に依存しないこと（SW にもバンドルされる）。
 */
import { EXTENSION_TO_FORMAT, MIME_TO_FORMAT, ZIP_MIME_TYPES } from "../domain/format.ts";
import type { Lang } from "../i18n/langs.ts";
import { BASE_PATH, STORAGE_PREFIX } from "./config.ts";

/** Service Worker の URL とスコープ（他アプリとスコープを重ねない。§4.3） */
export const SW_URL = `${BASE_PATH}/sw.js`;
export const SW_SCOPE = `${BASE_PATH}/`;

/** Workbox のキャッシュ名の接頭辞（"image-adjust-precache-..." になる） */
export const SW_CACHE_PREFIX = STORAGE_PREFIX.replace(/:$/, "");

/** 共有受け取り（manifest の share_target.action） */
export const SHARE_TARGET_PATH = `${BASE_PATH}/share-target`;
/** share_target.params.files[].name */
export const SHARE_TARGET_FIELD = "files";
/** 受け取ったファイルを変換画面に渡すまで置いておく Cache Storage の名前 */
export const SHARE_TARGET_CACHE = `${STORAGE_PREFIX}share-target`;
/** 共有後に開く変換画面の目印（?share=1） */
export const SHARE_QUERY_PARAM = "share";

/** 一時保存するファイルのキー（実在しない URL。キャッシュのキーとしてだけ使う） */
export function shareEntryUrl(origin: string, index: number): string {
  return `${origin}${BASE_PATH}/__share-target/${index}`;
}

/** 共有受け取り後のリダイレクト先（言語はマニフェストの action の ?lang= で受け取る） */
export function shareRedirectPath(lang: string | null): string {
  return `${BASE_PATH}/${lang === "en" ? "en/" : ""}?${SHARE_QUERY_PARAM}=1`;
}

/** 言語ごとのマニフェストのファイル名（BASE_PATH 直下） */
export function manifestFileName(lang: Lang): string {
  return `manifest.${lang}.webmanifest`;
}

/** ファイルの関連付け（file_handlers）・共有受け取りで受け付ける形式 */
export const ACCEPTED_FILE_TYPES: Record<string, string[]> = Object.fromEntries([
  ...Object.entries(MIME_TO_FORMAT).map(([mime, format]) => [
    mime,
    Object.entries(EXTENSION_TO_FORMAT)
      .filter(([, extensionFormat]) => extensionFormat === format)
      .map(([extension]) => `.${extension}`),
  ]),
  ...ZIP_MIME_TYPES.map((mime) => [mime, [".zip"]]),
]);
