import { SITE_ORIGIN } from "../../../platform/config/index.ts";
import { createAppPaths } from "../../../platform/paths/app-paths.ts";
import { manifest } from "../manifest.ts";

export {
  DEFAULT_SITE_ORIGIN,
  normalizeSiteOrigin,
  SITE_ORIGIN,
} from "../../../platform/config/index.ts";
export const BASE_PATH = `/${manifest.path}`;
export const STORAGE_PREFIX = `${manifest.id}:`;
export const API_BASE_PATH = `${BASE_PATH}/api`;
export const SITE_NAME = manifest.name.ja;
export const { withBase } = createAppPaths(manifest.path);
export function absoluteUrl(path: string): string {
  const pathname = path.startsWith(`${BASE_PATH}/`) ? path : withBase(path);
  return `${SITE_ORIGIN}${pathname}`;
}
export function absoluteAssetUrl(file: string): string {
  return `${SITE_ORIGIN}${BASE_PATH}/${file.replace(/^\/+/, "")}`;
}
