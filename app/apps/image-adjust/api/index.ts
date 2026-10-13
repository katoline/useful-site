import { Hono } from "hono";
import { manifest } from "../manifest";
import type { Env } from "./env";
import { fetchImageRoute } from "./routes/fetch-image";
export const appPath = manifest.path;
export const api = new Hono<{ Bindings: Env }>();
api.get("/health", (c) => c.json({ ok: true }));
api.route("/fetch-image", fetchImageRoute);
api.notFound((c) => c.json({ error: "not_found" }, 404));
