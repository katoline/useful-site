import path from "node:path";
import { pathToFileURL } from "node:url";
import type { RouteConfig } from "@react-router/dev/routes";
import { listAppDirs } from "./apps.ts";
export interface AppRoutes {
  appPath: string;
  createRoutes(): Awaited<RouteConfig>;
  allPagePaths(): string[];
  allBuildPaths(): string[];
}
/** アプリを中央の一覧に反映する必要をなくす。 */
export async function collectAppRoutes(): Promise<AppRoutes[]> {
  const dirs = await listAppDirs(path.resolve(import.meta.dirname, "../.."));
  return Promise.all(
    dirs.map(
      (dir) =>
        import(
          /* @vite-ignore */ pathToFileURL(path.join(dir, "routes.ts")).href
        ) as Promise<AppRoutes>,
    ),
  );
}
