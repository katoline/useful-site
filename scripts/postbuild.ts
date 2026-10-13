/** URL と一致する配置のまま、共通404・CSP の meta・セキュリティヘッダー・アプリのSWを仕上げる。 */
import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
// Node の型除去で直接実行するので、import 先は他を import しないファイルに限る
import { BASE_PATH } from "../app/platform/config/index.ts";
import { buildHeadersFile, type HeaderRule, injectCspMeta } from "./lib/csp.ts";
import type { AppPostbuild } from "./lib/postbuild-types.ts";

const clientDir = path.resolve(import.meta.dirname, "../build/client");
for (const lang of ["", "en"]) {
  const dir = path.join(clientDir, lang);
  const src = path.join(dir, "404/index.html");
  if (!existsSync(src)) throw new Error(`共通404がありません: ${src}`);
  await copyFile(src, path.join(dir, "404.html"));
  await rm(path.join(dir, "404"), { recursive: true });
}
// Workers は要求されたディレクトリに最も近い404を探すので、アプリ配下にも同じ共通ページを置く。
const appsDir = path.resolve(import.meta.dirname, "../app/apps");
for (const app of await readdir(appsDir, { withFileTypes: true })) {
  if (!app.isDirectory()) continue;
  const manifestFile = path.join(appsDir, app.name, "manifest.ts");
  const { manifest } = (await import(manifestFile)) as { manifest: { path: string } };
  if (!manifest.path) continue;
  for (const lang of ["", "en"]) {
    const dir = path.join(clientDir, manifest.path, lang);
    await mkdir(dir, { recursive: true });
    await copyFile(path.join(clientDir, lang, "404.html"), path.join(dir, "404.html"));
  }
}
const fallback = path.join(clientDir, "__spa-fallback.html");
if (existsSync(fallback)) await rm(fallback);

// 全 HTML（プリレンダリングしたページと 404.html）の head に、ページごとのハッシュ入りの CSP の meta を
// 入れる。アプリのフック（Image Adjust の Service Worker のプリキャッシュ等）が meta 入りの HTML を
// 対象にするよう、フックより前に行う
async function collectHtmlFiles(dir: string, top = true): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // ハッシュ付きのアセット（JS・CSS・WASM）は対象外
      if (top && entry.name === "assets") continue;
      files.push(...(await collectHtmlFiles(full, false)));
    } else if (entry.name.endsWith(".html")) {
      files.push(full);
    }
  }
  return files;
}
const htmlFiles = await collectHtmlFiles(clientDir);
for (const file of htmlFiles) {
  await writeFile(file, injectCspMeta(await readFile(file, "utf8")));
}
console.log(`postbuild: ${htmlFiles.length} 件の HTML に CSP の meta を入れました`);

// アプリのビルド後フック（app/apps/<id>/build/postbuild.ts）を規約で集めて呼ぶ
const extraHeaders: HeaderRule[] = [];
for (const app of await readdir(appsDir, { withFileTypes: true })) {
  if (!app.isDirectory()) continue;
  const hookFile = path.join(appsDir, app.name, "build/postbuild.ts");
  if (!existsSync(hookFile)) continue;
  const { manifest } = (await import(path.join(appsDir, app.name, "manifest.ts"))) as {
    manifest: { path: string };
  };
  const { postbuild } = (await import(hookFile)) as { postbuild: AppPostbuild };
  const result = await postbuild({
    root: path.resolve(import.meta.dirname, ".."),
    clientDir,
    appDir: path.join(clientDir, manifest.path),
    basePath: manifest.path ? `/${manifest.path}` : "",
  });
  extraHeaders.push(...(result.headers ?? []));
}
// _headers は Workers の静的アセットのルート（build/client/）に置く（URL ではなく設定ファイル）
const headers = buildHeadersFile(BASE_PATH, extraHeaders);
await writeFile(path.join(clientDir, "_headers"), headers);
const ruleCount = headers.split("\n").filter((line) => line && !line.startsWith(" ")).length;
console.log(`postbuild: _headers を書き出しました（${ruleCount} ルール）`);
