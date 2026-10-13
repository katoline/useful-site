/**
 * Service Worker の生成（scripts/postbuild.ts から、プリレンダリング完了後に呼ぶ）。
 *
 * 1. アプリの sw/sw.ts（呼び出し側が sourceEntry で渡す）を Vite（ライブラリモード・IIFE）で 1 ファイルにバンドルする
 * 2. アプリの配信ディレクトリの HTML・アイコン・マニフェストと、共有 /assets/ の JS・CSS・WASM を
 *    workbox-build の injectManifest で self.__WB_MANIFEST に埋め込む
 *
 * vite-plugin-pwa を使わない理由は AGENTS.md「組み合わせの都合」7（プリレンダリング HTML の出力が
 * Vite のバンドル完了より後で、かつ postbuild で配置が変わるため）。
 */
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { build } from "vite";
import { injectManifest } from "workbox-build";

/** プリキャッシュする 1 ファイルの上限。WASM（コーデック）を確実に含めるため大きめにする */
export const MAX_PRECACHE_FILE_BYTES = 20 * 1024 * 1024;

/**
 * プリキャッシュの URL を配信 URL に揃える。
 * "about/index.html" → "/<アプリ>/about/"、"index.html" → "/<アプリ>/"、それ以外は接頭辞だけ付ける
 * （Workers の html_handling: auto-trailing-slash では index.html 付きの URL はリダイレクトになるため）
 */
export function toPrecacheUrl(basePath: string, file: string): string {
  const cleaned = file === "index.html" ? "" : file.replace(/(^|\/)index\.html$/, "$1");
  return `${basePath}/${cleaned}`;
}

export async function generateServiceWorker(options: {
  /** プロジェクトのルート */
  root: string;
  sourceEntry: string;
  /** 配信ディレクトリ（build/client/app） */
  baseDir: string;
  /** "/<アプリ>"（先頭スラッシュ付き） */
  basePath: string;
}): Promise<{ count: number; size: number }> {
  const { root, baseDir, basePath, sourceEntry } = options;
  const tmp = await mkdtemp(path.join(tmpdir(), "app-sw-"));
  try {
    await build({
      configFile: false,
      root,
      logLevel: "warn",
      publicDir: false,
      // workbox の開発用ログを消す
      define: { "process.env.NODE_ENV": JSON.stringify("production") },
      build: {
        outDir: tmp,
        emptyOutDir: true,
        minify: true,
        sourcemap: false,
        copyPublicDir: false,
        lib: {
          entry: sourceEntry,
          formats: ["iife"],
          name: "appServiceWorker",
          fileName: () => "sw.js",
        },
      },
    });

    const { count, size, warnings } = await injectManifest({
      swSrc: path.join(tmp, "sw.js"),
      swDest: path.join(baseDir, "sw.js"),
      globDirectory: path.dirname(baseDir),
      globPatterns: [
        `${basePath.slice(1)}/**/*.{html,js,css,wasm,svg,png,ico,webmanifest,woff2}`,
        "assets/**/*.{js,css,wasm,woff2}",
      ],
      // 404 ページは配信 URL が別（存在しないパスで返る）なのでプリキャッシュしない
      globIgnores: ["**/sw.js", "**/404.html", "**/*.map"],
      maximumFileSizeToCacheInBytes: MAX_PRECACHE_FILE_BYTES,
      // ファイル名にハッシュが付いたアセットは revision を持たせない
      dontCacheBustURLsMatching: /^assets\//,
      manifestTransforms: [
        async (entries) => ({
          manifest: entries.map((entry) => ({ ...entry, url: toPrecacheUrl("", entry.url) })),
          warnings: [],
        }),
      ],
    });
    if (warnings.length > 0) {
      // サイズ上限で WASM 等が漏れるとオフラインで動かないので、警告は失敗にする
      throw new Error(`Service Worker の生成で警告がありました:\n${warnings.join("\n")}`);
    }
    await stat(path.join(baseDir, "sw.js"));
    return { count, size };
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}
