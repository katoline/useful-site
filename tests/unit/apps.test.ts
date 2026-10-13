import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer, type ViteDevServer } from "vite";
import { afterEach, describe, expect, it, vi } from "vitest";
import { findAppOgImagePaths } from "../../scripts/lib/app-og-images.ts";
import { listAppDirs, loadAppManifests } from "../../scripts/lib/apps.ts";
import { appOgImagesPlugin } from "../../scripts/vite-plugin-app-og-images.ts";

let root: string;
let server: ViteDevServer | undefined;
afterEach(async () => {
  await server?.close();
  server = undefined;
  if (root) await rm(root, { recursive: true, force: true });
});
async function fixture() {
  root = await mkdtemp(path.join(tmpdir(), "apps-test-"));
  for (const [id, order] of [
    ["first", 9],
    ["last", 1],
  ] as const) {
    const dir = path.join(root, "app", "apps", id);
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "manifest.ts"),
      `export const manifest = {id:${JSON.stringify(id)},path:${JSON.stringify(id)},order:${order}};`,
    );
  }
  await mkdir(path.join(root, "app", "apps", "no-manifest"));
  await writeFile(path.join(root, "app", "apps", "file.txt"), "ignored");
}

describe("アプリの共通収集", () => {
  it("manifest のないディレクトリと通常ファイルを飛ばして、manifest 順に返す", async () => {
    await fixture();
    expect((await listAppDirs(root)).map((dir) => path.basename(dir))).toEqual(["first", "last"]);
    expect((await loadAppManifests(root)).map(({ manifest }) => manifest.id)).toEqual([
      "last",
      "first",
    ]);
    expect(await findAppOgImagePaths(root)).toEqual([]);
  });
});

describe("OG 画像の仮想モジュール", () => {
  it("未作成の og/ に追加した日英画像と削除を再計算し、モジュールを無効化してリロードする", async () => {
    await fixture();
    server = await createServer({
      root,
      configFile: false,
      plugins: [appOgImagesPlugin(root)],
      server: { middlewareMode: true },
      optimizeDeps: { noDiscovery: true },
    });
    const reload = vi.spyOn(server.ws, "send");
    const code = async () => (await server?.transformRequest("virtual:app-og-images"))?.code;
    expect(await code()).toContain("[]");
    const dir = path.join(root, "app", "apps", "first", "public", "og");
    await mkdir(dir, { recursive: true });
    const ja = path.join(dir, "ja.png");
    const en = path.join(dir, "en.png");
    await writeFile(ja, "PNG");
    server.watcher.emit("add", ja);
    expect(await code()).toContain("[]");
    await writeFile(en, "PNG");
    server.watcher.emit("add", en);
    expect(await code()).toContain('["first"]');
    await rm(en);
    server.watcher.emit("unlink", en);
    expect(await code()).toContain("[]");
    expect(reload).toHaveBeenCalledWith({ type: "full-reload" });
  });
});
