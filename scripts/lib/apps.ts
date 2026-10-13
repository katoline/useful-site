/** Node の型除去でも使える、アプリのディレクトリ・manifest の共通収集。 */
import { access, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { AppManifest } from "../../app/platform/types.ts";

export interface AppEntry {
  dir: string;
  manifest: AppManifest;
}

/** manifest.ts があるディレクトリだけを名前順に返す。 */
export async function listAppDirs(root: string): Promise<string[]> {
  const appsDir = path.join(root, "app", "apps");
  const dirs: string[] = [];
  for (const entry of await readdir(appsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(appsDir, entry.name);
    try {
      await access(path.join(dir, "manifest.ts"));
      dirs.push(dir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return dirs.sort();
}

/** manifest の order 順（同値なら id 順）に返す。 */
export async function loadAppManifests(root: string): Promise<AppEntry[]> {
  const apps = await Promise.all(
    (await listAppDirs(root)).map(async (dir) => {
      const { manifest } = (await import(
        /* @vite-ignore */ pathToFileURL(path.join(dir, "manifest.ts")).href
      )) as {
        manifest: AppManifest;
      };
      return { dir, manifest };
    }),
  );
  return apps.sort(
    (a, b) =>
      (a.manifest.order ?? 0) - (b.manifest.order ?? 0) ||
      a.manifest.id.localeCompare(b.manifest.id),
  );
}
