/**
 * サイト自身のロゴとアイコンを public/ に生成する（`nix develop -c node scripts/generate-icons.ts`）。
 *
 * 1. ロゴ（app/lib/logo.ts の図形）を public/logo.svg に書き出す
 * 2. そのロゴを元画像にして、アイコン生成ツール（/icons/）と同じ処理（app/lib/icons/ の loadIconSource →
 *    generateIconFiles。ICO の組み立て・maskable の余白計算・favicon.svg の包み方もそのまま）で
 *    アイコン一式を作り、サイトで使うものだけを public/ に置く（plan.md §6.1）
 *
 * 描画は canvas が要るので、E2E 用に入っている Playwright の Chromium の中で動かす（ブラウザは Nix の devShell が
 * 供給する）。app/lib/icons/ は拡張子なしの import を含み Node から直接読めないので、
 * scripts/lib/icon-generator-entry.ts を Vite の build API で IIFE にバンドルしてページに入れる。
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "@playwright/test";
import { build } from "vite";
import { SITE_NAME } from "../app/lib/config.ts";
import { buildLogoSvg, LOGO_TILE_RADIUS_RATIO } from "../app/lib/logo.ts";
import type { GeneratedIconFile } from "./lib/icon-generator-entry.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");

/** タイルの色（tokens.css のダークの背景と同じ #0a0a0a）。透過できないアイコンの背景にも使う */
const TILE_COLOR = "#0a0a0a";

/**
 * アイコン生成の設定。ロゴは自分でタイル（角丸の面）を持つので余白は付けない。
 * 背景色と角丸をタイルにそろえておくと、apple-touch-icon（全面塗り）と maskable（セーフゾーンに縮めた
 * ロゴの周りを塗る）がタイルと同じ色でつながる
 */
const ICON_SETTINGS = {
  padding: 0,
  background: TILE_COLOR,
  radius: LOGO_TILE_RADIUS_RATIO,
  backgroundColor: TILE_COLOR,
};

/** 生成物のうち public/ に置くもの（生成ツールのファイル名 → public/ からのパス） */
const OUTPUTS: Record<string, string> = {
  "favicon.ico": "favicon.ico",
  "favicon.svg": "favicon.svg",
  "apple-touch-icon.png": "apple-touch-icon.png",
  "icon-192.png": "pwa/icon-192.png",
  "icon-512.png": "pwa/icon-512.png",
  "icon-maskable-512.png": "pwa/icon-maskable-512.png",
};

/** 生成ツールの favicon.svg は代替テキストを持たないので、サイト自身の分にはサイト名の <title> を足す */
function withTitle(svg: string): string {
  return svg.replace(/^(<svg\b[^>]*>)/, `$1<title>${SITE_NAME}</title>`);
}

/** icon-generator-entry.ts を 1 ファイルの IIFE にして、その中身を返す */
async function bundleGenerator(): Promise<string> {
  const outDir = mkdtempSync(path.join(tmpdir(), "image-adjust-icons-"));
  try {
    await build({
      configFile: false,
      root: ROOT,
      logLevel: "warn",
      publicDir: false,
      resolve: { alias: { "~": path.join(ROOT, "app") } },
      define: { "process.env.NODE_ENV": JSON.stringify("production") },
      build: {
        outDir,
        emptyOutDir: true,
        minify: false,
        sourcemap: false,
        copyPublicDir: false,
        lib: {
          entry: path.join(ROOT, "scripts/lib/icon-generator-entry.ts"),
          formats: ["iife"],
          name: "imageAdjustIconGenerator",
          fileName: () => "generator.js",
        },
      },
    });
    return readFileSync(path.join(outDir, "generator.js"), "utf8");
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}

async function main() {
  mkdirSync(path.join(PUBLIC_DIR, "pwa"), { recursive: true });
  const write = (file: string, data: Uint8Array | string) => {
    writeFileSync(path.join(PUBLIC_DIR, file), data);
    console.log(`public/${file}`);
  };

  const logoSvg = buildLogoSvg({ tile: TILE_COLOR, glyph: "#ffffff", title: SITE_NAME });
  write("logo.svg", logoSvg);

  const script = await bundleGenerator();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent("<!doctype html><html><body></body></html>");
    await page.addScriptTag({ content: script });
    const files = await page.evaluate(
      ([svg, settings]) =>
        (
          globalThis as unknown as {
            __generateIcons: (s: string, o: typeof settings) => Promise<GeneratedIconFile[]>;
          }
        ).__generateIcons(svg, settings),
      [logoSvg, ICON_SETTINGS] as const,
    );
    for (const [name, dest] of Object.entries(OUTPUTS)) {
      const file = files.find((f) => f.name === name);
      if (!file) throw new Error(`アイコン生成の結果に ${name} がありません`);
      const bytes = Uint8Array.from(file.bytes);
      write(dest, name === "favicon.svg" ? withTitle(new TextDecoder().decode(bytes)) : bytes);
    }
  } finally {
    await browser.close();
  }
}

await main();
