import { defineConfig, devices } from "@playwright/test";

// 並列作業でポートが衝突するときは E2E_PORT で変える
const PORT = Number(process.env.E2E_PORT) || 4173;

/**
 * E2E は本番と同じ構成（ビルド成果物を workerd で配信する `vite preview`）に対して流す。
 * ブラウザは Nix の devShell が PLAYWRIGHT_BROWSERS_PATH で供給する（`nix develop -c pnpm test:e2e`）。
 */
export default defineConfig({
  // サイト共通の E2E（tests/e2e）と、アプリ固有の E2E（app/apps/<id>/tests/e2e。アプリを消せば一緒に消える）
  testDir: ".",
  testMatch: /(^|\/)(tests\/e2e|app\/apps\/[^/]+\/tests\/e2e)\/[^/]+\.spec\.ts$/,
  fullyParallel: true,
  // 同じマシンで他の作業が走っていても安定するよう、並列数を抑えて待ち時間を長めにする
  workers: process.env.CI ? 2 : 4,
  expect: { timeout: 10_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    // 既にビルド済みなら E2E_SKIP_BUILD=1 で省略できる
    command: process.env.E2E_SKIP_BUILD
      ? `pnpm preview --port ${PORT} --strictPort`
      : `pnpm build && pnpm preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/image-adjust/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
