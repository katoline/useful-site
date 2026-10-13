import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Plugin } from "vite";

const TYPES: Record<string, string> = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
};
/** 許可されたファイルの一覧だけを公開し、URL をファイルシステムのパスに変換しない。 */
export function appPublicPlugin(): Plugin {
  const files = new Map<string, { source: Buffer; type: string }>();
  async function load() {
    files.clear();
    const appsDir = path.resolve(import.meta.dirname, "../app/apps");
    for (const app of await readdir(appsDir, { withFileTypes: true })) {
      if (!app.isDirectory()) continue;
      const { manifest } = (await import(path.join(appsDir, app.name, "manifest.ts"))) as {
        manifest: { path: string };
      };
      const publicDir = path.join(appsDir, app.name, "public");
      async function walk(dir: string, prefix: string) {
        let entries: import("node:fs").Dirent[];
        try {
          entries = await readdir(dir, { withFileTypes: true });
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
          throw error;
        }
        for (const entry of entries) {
          const name = `${prefix}${entry.name}`;
          if (entry.isDirectory()) await walk(path.join(dir, entry.name), `${name}/`);
          else if (entry.isFile())
            files.set(`/${[manifest.path, name].filter(Boolean).join("/")}`, {
              source: await readFile(path.join(dir, entry.name)),
              type: TYPES[path.extname(name)] ?? "application/octet-stream",
            });
        }
      }
      await walk(publicDir, "");
    }
  }
  return {
    name: "useful-site:app-public",
    enforce: "pre",
    async buildStart() {
      if (this.environment?.name === "client") await load();
    },
    generateBundle() {
      if (this.environment?.name !== "client") return;
      for (const [url, { source }] of files)
        this.emitFile({ type: "asset", fileName: url.slice(1), source });
    },
    async configureServer(server) {
      await load();
      server.middlewares.use((req, res, next) => {
        let pathname: string;
        try {
          pathname = decodeURIComponent((req.url ?? "").split("?")[0] ?? "");
        } catch {
          return next();
        }
        const file = files.get(pathname);
        if (!file) return next();
        res.setHeader("content-type", file.type);
        res.end(file.source);
      });
    },
  };
}
