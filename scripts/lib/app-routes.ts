import { readdir } from "node:fs/promises";
import type { RouteConfig } from "@react-router/dev/routes";
export interface AppRoutes {
  appPath: string;
  createRoutes(): Awaited<RouteConfig>;
  allPagePaths(): string[];
  allBuildPaths(): string[];
}
/** アプリを中央の一覧に反映する必要をなくす。 */
export async function collectAppRoutes(): Promise<AppRoutes[]> {
  const appsDir = new URL("../../app/apps/", import.meta.url);
  const entries = await readdir(appsDir, { withFileTypes: true });
  return Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(
        (entry) =>
          import(
            /* @vite-ignore */ new URL(`${entry.name}/routes.ts`, appsDir).href
          ) as Promise<AppRoutes>,
      ),
  );
}
