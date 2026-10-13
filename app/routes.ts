import { prefix, type RouteConfig, route } from "@react-router/dev/routes";
import { collectAppRoutes } from "../scripts/lib/app-routes.ts";

const apps = await collectAppRoutes();
export default [
  route("privacy", "platform/pages/privacy.tsx", { id: "site/ja/privacy" }),
  route("terms", "platform/pages/terms.tsx", { id: "site/ja/terms" }),
  route("en/privacy", "platform/pages/privacy.tsx", { id: "site/en/privacy" }),
  route("en/terms", "platform/pages/terms.tsx", { id: "site/en/terms" }),
  ...apps.flatMap((app) =>
    app.appPath ? prefix(app.appPath, app.createRoutes()) : app.createRoutes(),
  ),
  route("*", "platform/shell/not-found-route.tsx", { id: "site/not-found" }),
] satisfies RouteConfig;
