/**
 * Cloudflare Worker（Hono）。/image-adjust/api/* だけを処理し、それ以外は静的アセットへ渡す。
 * 静的アセットの振り分けは wrangler.jsonc の assets.run_worker_first でも行っている。
 */
import { Hono } from "hono";
import { API_BASE_PATH } from "../app/lib/config";
import type { Env } from "./env";
import { fetchImageRoute } from "./routes/fetch-image";

export type { Env };

export const api = new Hono<{ Bindings: Env }>().basePath(API_BASE_PATH);

api.get("/health", (c) => c.json({ ok: true }));

// URL 入力の中継（悪用対策は worker/routes/fetch-image.ts）
api.route("/fetch-image", fetchImageRoute);

api.notFound((c) => c.json({ error: "not_found" }, 404));

export default {
  fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === API_BASE_PATH || pathname.startsWith(`${API_BASE_PATH}/`)) {
      return api.fetch(request, env, ctx);
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
