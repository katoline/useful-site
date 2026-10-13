/** Image Adjust のビルド後フック。Service Worker（スコープはこのアプリの配下）を生成する。 */
import path from "node:path";
import type { AppBuildContext, AppBuildResult } from "../../../../scripts/lib/postbuild-types.ts";
import { generateServiceWorker } from "../../../../scripts/lib/service-worker.ts";

export async function postbuild(context: AppBuildContext): Promise<AppBuildResult> {
  const sw = await generateServiceWorker({
    root: context.root,
    sourceEntry: path.resolve(import.meta.dirname, "../sw/sw.ts"),
    baseDir: context.appDir,
    basePath: context.basePath,
  });
  console.log(`postbuild: ${context.basePath}/sw.js（プリキャッシュ ${sw.count} 件）`);
  // SW 自体は毎回確認させる（更新の検出が遅れないように）
  return { headers: [{ path: `${context.basePath}/sw.js`, headers: ["Cache-Control: no-cache"] }] };
}
