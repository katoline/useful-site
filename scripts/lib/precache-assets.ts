/**
 * Service Worker のプリキャッシュに入れる共有アセット（build/client/assets/）を、
 * あるアプリの HTML から到達できるものだけに絞る（他アプリのチャンクを入れない）。
 *
 * 起点：HTML の中の、アセットのファイル名への参照（<script src>・<link rel="modulepreload" | "stylesheet">・
 * インラインスクリプト内の "/assets/…"）。
 * 推移：JS / CSS の中の、アセットのファイル名への参照（相対 import の "./x-hash.js"・
 * new URL("/assets/x.wasm", import.meta.url)・Vite の __vite__mapDeps の "assets/x.js"・CSS の url() 等）。
 * Vite の出力するアセット名はハッシュ付きで一意なので、「アセットのファイル名がそのまま文字列として
 * 現れるか」で参照を判定する（構文を解析しない）。
 *
 * 例外：全アプリのルートを列挙するファイル（React Router のルートマニフェスト `window.__reactRouterManifest`）
 * はプリキャッシュには入れるが、その中身からは辿らない（辿ると全アプリのチャンクが入る）。
 *
 * Node の型除去で直接実行する（postbuild から）ので、node: 以外を import しない。
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

/** 中身を辿るアセットの拡張子（それ以外のバイナリ・画像等は参照される側にだけなる） */
const TRAVERSE_EXTENSIONS = new Set([".js", ".mjs", ".css"]);

/** React Router が生成するルートマニフェストだけ、中身を辿らない */
export function enumeratesAllRoutes(name: string, content: string): boolean {
  return (
    /^manifest-[\w-]+\.js$/.test(name) && /^\s*window\.__reactRouterManifest\s*=/.test(content)
  );
}

/** アセット名の前後に来てはいけない文字（ファイル名の一部とみなす文字） */
const NAME_CHAR = /[\w-]/;

/** content の中に name がファイル名として（前後がファイル名の文字に続かずに）現れるか */
export function referencesName(content: string, name: string): boolean {
  let from = 0;
  for (;;) {
    const at = content.indexOf(name, from);
    if (at < 0) return false;
    const before = at > 0 ? (content[at - 1] ?? "") : "";
    const after = content[at + name.length] ?? "";
    if (!NAME_CHAR.test(before) && !NAME_CHAR.test(after)) return true;
    from = at + 1;
  }
}

/** content が参照するアセット名（assetNames のうち） */
export function findReferencedAssets(content: string, assetNames: Iterable<string>): string[] {
  return [...assetNames].filter((name) => referencesName(content, name));
}

export interface CollectOptions {
  /** 起点の文書（HTML）の中身 */
  entries: string[];
  /** 共有アセットのファイル名（assets/ 直下の basename） */
  assetNames: Iterable<string>;
  /** アセットの中身（テキスト）を返す。辿らない拡張子では呼ばれない */
  readAsset: (name: string) => Promise<string>;
  /** 中身を辿らないファイルか（既定は React Router のルートマニフェスト） */
  skipTraversal?: (name: string, content: string) => boolean;
}

/** entries から推移的に到達できるアセット名（整列済み） */
export async function collectReachableAssets(options: CollectOptions): Promise<string[]> {
  const names = [...new Set(options.assetNames)];
  const skip = options.skipTraversal ?? enumeratesAllRoutes;
  const reached = new Set<string>();
  const queue: string[] = [];
  const visit = (content: string) => {
    for (const name of findReferencedAssets(content, names)) {
      if (reached.has(name)) continue;
      reached.add(name);
      queue.push(name);
    }
  };
  for (const entry of options.entries) visit(entry);
  for (let name = queue.shift(); name !== undefined; name = queue.shift()) {
    if (!TRAVERSE_EXTENSIONS.has(path.extname(name).toLowerCase())) continue;
    const content = await options.readAsset(name);
    if (skip(name, content)) continue;
    visit(content);
  }
  return [...reached].sort();
}

async function listFiles(dir: string, filter: (file: string) => boolean): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    const file = path.join(entry.parentPath, entry.name);
    if (filter(file)) result.push(file);
  }
  return result.sort();
}

/**
 * appDir 配下の HTML から到達できる、clientDir/<assetsDir>/ のアセットを
 * clientDir からの相対パス（"assets/x-hash.js"）で返す。
 * 404.html も起点にする（404.html 自体はプリキャッシュしないが、オフラインのクライアント側遷移で
 * 存在しないパスに来たときに not-found のルートのチャンクが要るため）
 */
export async function findAppAssets(options: {
  clientDir: string;
  appDir: string;
  assetsDir?: string;
}): Promise<string[]> {
  const assetsDir = options.assetsDir ?? "assets";
  const assetsPath = path.join(options.clientDir, assetsDir);
  const assetNames = (await readdir(assetsPath, { withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name);
  const htmlFiles = await listFiles(options.appDir, (file) => file.endsWith(".html"));
  const entries = await Promise.all(htmlFiles.map((file) => readFile(file, "utf8")));
  const reached = await collectReachableAssets({
    entries,
    assetNames,
    readAsset: (name) => readFile(path.join(assetsPath, name), "utf8"),
  });
  return reached.map((name) => `${assetsDir}/${name}`);
}
