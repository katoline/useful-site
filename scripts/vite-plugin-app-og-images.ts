import path from "node:path";
import type { Plugin } from "vite";
import { findAppOgImagePaths } from "./lib/app-og-images.ts";

export const APP_OG_IMAGES_MODULE = "virtual:app-og-images";
const RESOLVED_MODULE = `\0${APP_OG_IMAGES_MODULE}`;

/** platform と Vitest が同じ収集処理を使う。未作成の og/ も親から監視する。 */
export function appOgImagesPlugin(root = path.resolve(import.meta.dirname, "..")): Plugin {
  return {
    name: "useful-site:app-og-images",
    resolveId(id) {
      if (id === APP_OG_IMAGES_MODULE) return RESOLVED_MODULE;
    },
    async load(id) {
      if (id !== RESOLVED_MODULE) return;
      const paths = await findAppOgImagePaths(root);
      return `export const appOgImagePaths = ${JSON.stringify(paths)};`;
    },
    configureServer(server) {
      const appsDir = path.join(root, "app", "apps");
      server.watcher.add(appsDir);
      const refresh = (file: string) => {
        const relative = path.relative(appsDir, file).split(path.sep).join("/");
        if (!/^[^/]+\/public\/og\/(?:ja|en)\.png$/.test(relative)) return;
        for (const environment of Object.values(server.environments)) {
          const module = environment.moduleGraph.getModuleById(RESOLVED_MODULE);
          if (module) environment.moduleGraph.invalidateModule(module);
        }
        server.ws.send({ type: "full-reload" });
      };
      server.watcher.on("add", refresh);
      server.watcher.on("unlink", refresh);
      server.httpServer?.once("close", () => {
        server.watcher.off("add", refresh);
        server.watcher.off("unlink", refresh);
      });
    },
  };
}
