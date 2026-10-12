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
  },
} satisfies Config;
