import { Hono } from "hono";
import type { Env } from "./env";

interface AppApi {
  appPath: string;
  api: Hono<{ Bindings: Env }>;
}
const modules = import.meta.glob<AppApi>("../app/apps/*/api/index.ts", { eager: true });
export const api = new Hono<{ Bindings: Env }>();
const apiPaths = Object.values(modules).map((module) => {
  const basePath = `/${module.appPath}/api`;
  api.route(basePath, module.api);
  return basePath;
});
api.notFound((c) => c.json({ error: "not_found" }, 404));
export default {
  fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (apiPaths.some((base) => pathname === base || pathname.startsWith(`${base}/`))) {
      return api.fetch(request, env, ctx);
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
