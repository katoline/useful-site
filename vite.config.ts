import path from "node:path";
import { cloudflare } from "@cloudflare/vite-plugin";
import mdx from "@mdx-js/rollup";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import remarkGfm from "remark-gfm";
import { defineConfig } from "vite";
import { appOgImagesPlugin } from "./scripts/vite-plugin-app-og-images.ts";
import { appPublicPlugin } from "./scripts/vite-plugin-app-public.ts";
import { siteFilesPlugin } from "./scripts/vite-plugin-site-files.ts";

export default defineConfig({
  // サイト共通のアセットはドメイン直下で配信する
  base: "/",
  resolve: {
    alias: { "~": path.resolve(import.meta.dirname, "app") },
  },
  plugins: [
    // MDX は React Router より先に変換する
    { enforce: "pre", ...mdx({ remarkPlugins: [remarkGfm] }) },
    tailwindcss(),
    // React Router を cloudflare() より前に置く。dev ではページの HTML を React Router の
    // ミドルウェアが返し、残り（/image-adjust/api/* 等）を cloudflare() が workerd に渡す
    reactRouter(),
    // Hono の Worker（worker/index.ts）を workerd で動かす。ページは静的アセットとして配信する
    cloudflare(),
    // PWA のマニフェスト（日英）と sitemap.xml を出す。Service Worker は postbuild で生成する
    // （プリレンダリング後の HTML をプリキャッシュに含めるため。AGENTS.md「組み合わせの都合」7）
    siteFilesPlugin(),
    appPublicPlugin(),
    appOgImagesPlugin(),
  ],
  environments: {
    // Worker（wrangler.jsonc の name を snake_case にした環境名）の出力先を build/ にまとめる
    useful_site: { build: { outDir: "build/worker" } },
  },
  worker: {
    // Web Worker は ES モジュールで出す（new Worker(new URL(...), { type: "module" })）
    format: "es",
  },
});
