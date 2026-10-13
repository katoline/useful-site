import path from "node:path";
import { defineConfig } from "vitest/config";
import { appOgImagesPlugin } from "./scripts/vite-plugin-app-og-images.ts";

// React Router / Cloudflare のプラグインは読み込まない（単体テストを軽く保つ）
export default defineConfig({
  plugins: [appOgImagesPlugin()],
  resolve: {
    alias: { "~": path.resolve(import.meta.dirname, "app") },
  },
  test: {
    include: ["tests/unit/**/*.test.{ts,tsx}", "app/**/*.test.{ts,tsx}", "worker/**/*.test.ts"],
    // DOM が要るテストはファイル先頭に `// @vitest-environment happy-dom` を書く
    environment: "node",
  },
});
