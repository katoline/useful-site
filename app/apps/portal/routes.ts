import { index, prefix, type RouteConfig } from "@react-router/dev/routes";
export const appPath = "";
export function createRoutes(): Awaited<RouteConfig> {
  return [
    index("apps/portal/pages/home.tsx", { id: "portal/ja/home" }),
    ...prefix("en", [index("apps/portal/pages/home.tsx", { id: "portal/en/home" })]),
  ];
}
export function allPagePaths() {
  return [""];
}
export function allBuildPaths() {
  return ["/", "/en"];
}
