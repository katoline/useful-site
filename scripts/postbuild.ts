/**
 * ビルド後の整形（`pnpm build` から実行）。
 *
 * React Router はプリレンダリング HTML を build/client/image-adjust/ 以下（basename 付き）に書くが、
 * Vite は JS / CSS / WASM / public の中身を build/client/ 直下に書く（URL には base が付くのに、
 * 出力先には付かない）。Workers の静的アセットは「URL のパス = ディレクトリ内のパス」で配信するので、
 * build/client/ 直下のものを build/client/image-adjust/ に移して URL と揃える。
 *
 * あわせて、プリレンダリングした 404 ページを Workers の not_found_handling: "404-page" が使う
 * 404.html に置き、使わない SPA フォールバックを消す。
 */
import { existsSync } from "node:fs";
import { copyFile, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
// Node の型除去で直接実行するので、import 先は他を import しないファイルに限る
import { BASE_PATH } from "../app/lib/config.ts";
import { buildHeadersFile, type PageHtml } from "./lib/csp.ts";
import { generateServiceWorker } from "./lib/service-worker.ts";

const clientDir = path.resolve(import.meta.dirname, "../build/client");
const baseDirName = BASE_PATH.replace(/^\/+/, "");
const baseDir = path.join(clientDir, baseDirName);

/** build/client/ 直下に残すもの（Workers の設定ファイル類） */
const KEEP_AT_ROOT = new Set([baseDirName, ".assetsignore", ".vite", "_headers"]);

if (!existsSync(baseDir)) {
  throw new Error(`プリレンダリングの出力がありません: ${baseDir}`);
}

for (const entry of await readdir(clientDir)) {
  if (KEEP_AT_ROOT.has(entry)) continue;
  const from = path.join(clientDir, entry);
  if (entry === "__spa-fallback.html") {
    await rm(from);
    continue;
  }
  const to = path.join(baseDir, entry);
  if (existsSync(to)) {
    throw new Error(`移動先が既にあります（public/ とルートの衝突）: ${to}`);
  }
  await rename(from, to);
}

// 404 ページ：<言語>/404/index.html → <言語>/404.html（app/lib/site-routes.ts の NOT_FOUND_PAGE）
let notFoundCount = 0;
for (const dir of [baseDir, ...(await readdir(baseDir)).map((d) => path.join(baseDir, d))]) {
  const src = path.join(dir, "404", "index.html");
  if (!existsSync(src)) continue;
  await copyFile(src, path.join(dir, "404.html"));
  await rm(path.join(dir, "404"), { recursive: true });
  notFoundCount++;
}
if (notFoundCount === 0) throw new Error("404 ページがプリレンダリングされていません");

console.log(`postbuild: アセットを ${path.relative(process.cwd(), baseDir)} に移動しました`);

// プリレンダリングしたページ（<パス>/index.html）を集める
async function collectPages(dir: string, urlPath: string): Promise<PageHtml[]> {
  const pages: PageHtml[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (urlPath === `${BASE_PATH}/` && entry.name === "assets") continue;
      pages.push(...(await collectPages(path.join(dir, entry.name), `${urlPath}${entry.name}/`)));
    } else if (entry.name === "index.html") {
      pages.push({ urlPath, html: await readFile(path.join(dir, entry.name), "utf8") });
    }
  }
  return pages;
}
const pages = await collectPages(baseDir, `${BASE_PATH}/`);

// セキュリティヘッダー（CSP はページごとのインラインスクリプトのハッシュ入り）。
// _headers は Workers の静的アセットのルート（build/client/）に置く（URL ではなく設定ファイル）
await writeFile(path.join(clientDir, "_headers"), buildHeadersFile(BASE_PATH, pages));
console.log(`postbuild: _headers を書き出しました（${pages.length} ページの CSP）`);

// Service Worker（プリキャッシュに日英の全ページの HTML を含めるため、配置が確定した後に作る）
const sw = await generateServiceWorker({
  root: path.resolve(import.meta.dirname, ".."),
  baseDir,
  basePath: BASE_PATH,
});
console.log(
  `postbuild: sw.js を生成しました（プリキャッシュ ${sw.count} 件、${(sw.size / 1024 / 1024).toFixed(1)} MB）`,
);
