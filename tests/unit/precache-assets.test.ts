import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  collectReachableAssets,
  findAppAssets,
  referencesName,
} from "../../scripts/lib/precache-assets.ts";
import { escapeGlob, filterPrecacheAssets } from "../../scripts/lib/service-worker.ts";

describe("referencesName", () => {
  it("ファイル名として現れるときだけ参照とみなす", () => {
    expect(referencesName('import"./png-abc.js"', "png-abc.js")).toBe(true);
    expect(referencesName("new URL(`/assets/x-1.wasm`,import.meta.url)", "x-1.wasm")).toBe(true);
    expect(referencesName("url(/assets/font-9.woff2)", "font-9.woff2")).toBe(true);
    // 別のファイル名の一部
    expect(referencesName('"./squoosh_png-abc.js"', "png-abc.js")).toBe(false);
    expect(referencesName('"./png-abc.json"', "png-abc.js")).toBe(false);
  });
});

/** 2 つのアプリが共有の assets/ を使う、ビルド後の配置を模した組 */
const FILES: Record<string, string> = {
  // 共通
  "assets/entry.client-1.js": 'import"./jsx-runtime-1.js";',
  "assets/jsx-runtime-1.js": "export const x=1;",
  "assets/root-1.css": ".a{background:url(/assets/bg-1.png)}",
  "assets/bg-1.png": "PNG",
  // 全アプリのルートを列挙するマニフェスト（中身は辿らない）
  "assets/manifest-1.js":
    'window.__reactRouterManifest={"routes":{"a":{"module":"/assets/tool-a-1.js"},"b":{"module":"/assets/tool-b-1.js"}}};',
  // アプリ A：ページ → Worker → WASM、動的 import（Vite の __vite__mapDeps）
  "assets/tool-a-1.js":
    'const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/codec-a-1.js"])))=>i.map(i=>d[i]);new Worker(new URL(`/assets/a.worker-1.js`,``+import.meta.url));',
  "assets/codec-a-1.js": "export const c=1;",
  "assets/a.worker-1.js": 'import"./wasm-glue-1.js";',
  "assets/wasm-glue-1.js": "new URL(`/assets/codec_bg-1.wasm`,``+import.meta.url)",
  "assets/codec_bg-1.wasm": "WASM",
  // アプリ B 固有（入ってはいけない）
  "assets/tool-b-1.js": 'import("./markdown-it-1.js")',
  "assets/markdown-it-1.js": "export default 1;",
  "a/index.html":
    '<link rel="stylesheet" href="/assets/root-1.css"/><link rel="modulepreload" href="/assets/manifest-1.js"/><link rel="modulepreload" href="/assets/tool-a-1.js"/><script>import("/assets/entry.client-1.js")</script>',
  "a/404.html": '<link rel="modulepreload" href="/assets/not-found-1.js"/>',
  "assets/not-found-1.js": "export {};",
  "b/index.html": '<link rel="modulepreload" href="/assets/tool-b-1.js"/>',
};

let dir: string | undefined;
afterEach(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
  dir = undefined;
});

describe("findAppAssets", () => {
  it("アプリの HTML から推移的に到達できるアセットだけを返し、マニフェストの中身は辿らない", async () => {
    dir = await mkdtemp(path.join(tmpdir(), "precache-assets-"));
    for (const [file, content] of Object.entries(FILES)) {
      await mkdir(path.dirname(path.join(dir, file)), { recursive: true });
      await writeFile(path.join(dir, file), content);
    }
    const assets = await findAppAssets({ clientDir: dir, appDir: path.join(dir, "a") });
    expect(assets).toEqual([
      "assets/a.worker-1.js",
      "assets/bg-1.png",
      "assets/codec-a-1.js",
      "assets/codec_bg-1.wasm",
      "assets/entry.client-1.js",
      "assets/jsx-runtime-1.js",
      "assets/manifest-1.js",
      "assets/not-found-1.js",
      "assets/root-1.css",
      "assets/tool-a-1.js",
      "assets/wasm-glue-1.js",
    ]);
    expect(assets).not.toContain("assets/tool-b-1.js");
    expect(assets).not.toContain("assets/markdown-it-1.js");
  });
});

describe("collectReachableAssets", () => {
  it("manifest を参照する実行時チャンクは依存先を辿る", async () => {
    const files: Record<string, string> = {
      "entry.client-a.js": 'const manifest=window.__reactRouterManifest;import "./runtime-a.js";',
      "runtime-a.js": 'const manifest=window.__reactRouterManifest;import "./codec-a.js";',
      "codec-a.js": "export {};",
    };
    expect(
      await collectReachableAssets({
        entries: ['"entry.client-a.js"'],
        assetNames: Object.keys(files),
        readAsset: async (name) => files[name] ?? "",
      }),
    ).toEqual(["codec-a.js", "entry.client-a.js", "runtime-a.js"]);
  });

  it("循環する参照でも止まる", async () => {
    const files: Record<string, string> = { "a.js": '"./b.js"', "b.js": '"./a.js"' };
    const result = await collectReachableAssets({
      entries: ['<script src="/assets/a.js"></script>'],
      assetNames: Object.keys(files),
      readAsset: async (name) => files[name] ?? "",
    });
    expect(result).toEqual(["a.js", "b.js"]);
  });
});

describe("escapeGlob", () => {
  it("glob の特殊文字を逃がす", () => {
    expect(escapeGlob("assets/a-[x]+(y).js")).toBe("assets/a-\\[x\\]\\+\\(y\\).js");
    expect(escapeGlob("assets/plain-Ab_1.js")).toBe("assets/plain-Ab_1.js");
  });
});

describe("filterPrecacheAssets", () => {
  it("到達した map・画像・globIgnores の対象は Workbox に渡さない", () => {
    expect(
      filterPrecacheAssets([
        "assets/a.js",
        "assets/a.css",
        "assets/a.wasm",
        "assets/a.woff2",
        "assets/a.js.map",
        "assets/a.png",
        "assets/a.svg",
        "assets/sw.js",
        "assets/404.html",
      ]),
    ).toEqual(["assets/a.js", "assets/a.css", "assets/a.wasm", "assets/a.woff2"]);
  });
});
