import type { AppManifest } from "../types";
import { validateManifests } from "./validation";

const modules = import.meta.glob<{ manifest: AppManifest }>("../../apps/*/manifest.ts", {
  eager: true,
});
export const allApps: readonly AppManifest[] = Object.values(modules)
  .map(({ manifest }) => manifest)
  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id));
validateManifests(allApps);
export const listedApps = allApps.filter((app) => app.path && app.status !== "hidden");
export function getAppByPath(path: string) {
  return allApps.find((app) => app.path === path);
}
export { validateManifests } from "./validation";
