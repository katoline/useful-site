import path from "node:path";
import { defineConfig } from "vitest/config";

// React Router / Cloudflare のプラグインは読み込まない（単体テストを軽く保つ）
export default defineConfig({
  resolve: {
    alias: { "~": path.resolve(import.meta.dirname, "app") },
  },
  test: {
    include: ["tests/unit/**/*.test.{ts,tsx}", "app/**/*.test.{ts,tsx}", "worker/**/*.test.ts"],
    // DOM が要るテストはファイル先頭に `// @vitest-environment happy-dom` を書く
    environment: "node",
  },
});
