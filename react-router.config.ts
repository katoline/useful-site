import type { Config } from "@react-router/dev/config";
import { BASE_PATH } from "./app/lib/config";
import { allBuildPaths } from "./app/lib/site-routes";

export default {
  // SEO のため全ページをビルド時に静的 HTML にする。SSR はしない
  ssr: false,
  basename: `${BASE_PATH}/`,
  prerender: () => allBuildPaths(),
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
