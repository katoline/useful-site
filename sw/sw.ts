/**
 * Service Worker（/image-adjust/sw.js、スコープ /image-adjust/）。plan.md §6.1・§4.2・§4.3・§7.4。
 *
 * - アプリ本体（日英の全ページの HTML・JS・CSS・WASM・アイコン・マニフェスト）をプリキャッシュする。
 *   一覧（self.__WB_MANIFEST）は scripts/lib/service-worker.ts が postbuild で workbox-build の
 *   injectManifest で埋め込む（プリレンダリング後の HTML を含めるため）
 * - 更新は「更新があります」→ 利用者の操作で SKIP_WAITING を受けてから切り替える（registerType: prompt 相当）
 * - キャッシュ名は "image-adjust" 接頭辞。古いキャッシュの削除も自分の接頭辞のものだけにする
 * - ランタイムキャッシュは持たない。プリキャッシュに無いリクエスト（広告・解析・/image-adjust/api/）は
 *   素通しでネットワークへ行く（キャッシュしない）
 * - 共有受け取り（share_target）：POST /image-adjust/share-target の画像を Cache Storage に一時保存し、
 *   変換画面（/image-adjust/?share=1）にリダイレクトする。ページ側（app/components/pwa/PwaRoot.tsx）が
 *   取り出して pushIncomingFiles() に渡し、キャッシュを消す
 */
import { cacheNames, clientsClaim, setCacheNameDetails } from "workbox-core";
import { type PrecacheEntry, precacheAndRoute } from "workbox-precaching";
import {
  SHARE_TARGET_CACHE,
  SHARE_TARGET_FIELD,
  SHARE_TARGET_PATH,
  SW_CACHE_PREFIX,
  shareEntryUrl,
  shareRedirectPath,
} from "../app/lib/pwa.ts";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: (string | PrecacheEntry)[];
};

setCacheNameDetails({ prefix: SW_CACHE_PREFIX, suffix: "" });

// ---- 共有受け取り（fetch リスナーは登録順に呼ばれるので、プリキャッシュより先に登録する） ----

/**
 * 他サイトのフォームからの POST か。OS の共有シートからは Sec-Fetch-Site: none、
 * 同一オリジンのフォームからは same-origin になる。cross-site / same-site（同居する他アプリ等）は受け取らない。
 * 未確認：Android 実機の共有で none になること（AGENTS.md の PWA の節）。
 * ヘッダーが見えない環境では Referer のオリジンで代わりに判定する（OS の共有には Referer が無い）
 */
function isForeignPost(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site) return site !== "none" && site !== "same-origin";
  if (!request.referrer || request.referrer === "about:client") return false;
  try {
    return new URL(request.referrer).origin !== self.location.origin;
  } catch {
    return true;
  }
}

async function receiveShare(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const lang = url.searchParams.get("lang");
  // 他サイトから送り込まれたファイルは保存せず、変換画面を開くだけにする
  if (isForeignPost(request)) {
    return Response.redirect(new URL(shareRedirectPath(lang), self.location.origin).href, 303);
  }
  try {
    const form = await request.formData();
    const files = form.getAll(SHARE_TARGET_FIELD).filter((v): v is File => v instanceof File);
    // 前回の取り残しは捨ててから置き直す
    await caches.delete(SHARE_TARGET_CACHE);
    const cache = await caches.open(SHARE_TARGET_CACHE);
    await Promise.all(
      files.map((file, i) =>
        cache.put(
          shareEntryUrl(self.location.origin, i),
          new Response(file, {
            headers: {
              "content-type": file.type || "application/octet-stream",
              "x-file-name": encodeURIComponent(file.name),
              "x-last-modified": String(file.lastModified),
            },
          }),
        ),
      ),
    );
  } catch {
    // 受け取れなくても変換画面は開く
  }
  return Response.redirect(new URL(shareRedirectPath(lang), self.location.origin).href, 303);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "POST") return;
  const { pathname } = new URL(request.url);
  if (pathname !== SHARE_TARGET_PATH && pathname !== `${SHARE_TARGET_PATH}/`) return;
  event.respondWith(receiveShare(request));
});

// ---- プリキャッシュ ----

precacheAndRoute(self.__WB_MANIFEST, {
  // ?share=1 で開いた変換画面もプリキャッシュした HTML で返す
  // URL は postbuild で "/image-adjust/about/" の形（index.html を付けない）にしてある
  ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^share$/],
});

// ---- 更新（prompt）：利用者が「再読み込み」を押したときだけ待機中の SW を有効にする ----

self.addEventListener("message", (event) => {
  if ((event.data as { type?: string } | null)?.type === "SKIP_WAITING") {
    void self.skipWaiting();
  }
});

// 初回インストール時は開いているページもすぐ制御する（共有受け取り・オフラインをすぐ使えるように）
clientsClaim();

// 古いプリキャッシュの削除。自分の接頭辞（image-adjust-precache-）のものだけを対象にする
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const current = cacheNames.precache;
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith(`${SW_CACHE_PREFIX}-precache-`) && name !== current)
          .map((name) => caches.delete(name)),
      );
    })(),
  );
});
