import type { Config } from "@react-router/dev/config";
import { allLegalBuildPaths } from "./app/platform/legal/paths.ts";
import { collectAppRoutes } from "./scripts/lib/app-routes.ts";

export default {
  // SEO のため全ページをビルド時に静的 HTML にする。SSR はしない
  ssr: false,
  basename: "/",
  prerender: async () => [
    ...(await collectAppRoutes()).flatMap((app) => app.allBuildPaths()),
    ...allLegalBuildPaths(),
    "/404",
    "/en/404",
  ],
  future: {
    // @cloudflare/vite-plugin と併用するため Vite の Environment API を使う
    v8_viteEnvironmentApi: true,
    // v8 の既定の挙動に先にそろえる（このサイトはルートの loader / action / middleware を使わない）
    v8_middleware: true,
    v8_splitRouteModules: true,
    v8_passThroughRequests: true,
    v8_trailingSlashAwareDataRequests: true,
  },
} satisfies Config;
