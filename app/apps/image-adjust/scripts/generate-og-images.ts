/**
 * 言語別の OGP 画像（1200×630）を app/apps/image-adjust/public/og/<lang>.png に生成する
 * （`nix develop -c node app/apps/image-adjust/scripts/generate-og-images.ts`）。plan.md §3.7・§9.3。
 *
 * 文字（日本語を含む）を描くため、依存を増やさず、E2E 用に入っている Playwright の Chromium で
 * HTML を描画してスクリーンショットを撮る（ブラウザは Nix の devShell が供給する）。
 * ロゴは app/apps/image-adjust/public/logo.svg と同じ図形（app/apps/image-adjust/lib/logo.ts）。当面は言語ごとに共通の 1 枚。
 * ロゴを変えたら app/apps/image-adjust/scripts/generate-icons.ts と合わせて作り直す。
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
import { SITE_NAME } from "../lib/config.ts";
import { buildLogoSvg } from "../lib/logo.ts";

const PUBLIC_DIR = path.resolve(import.meta.dirname, "../public");
// 白い背景に黒いタイル（ロゴ自身が面を持つ）。読み上げは h1 のサイト名で足りるので title は付けない
const LOGO_SVG = buildLogoSvg({ tile: "#0a0a0a", glyph: "#ffffff" });

/** 画像に入れる文言 */
const TEXT = {
  ja: {
    lang: "ja",
    title: SITE_NAME,
    lead: "画像の変換・圧縮・アイコン生成を、<br>ブラウザだけで。",
    note: "PNG / JPEG / WebP / GIF / SVG ・ 画像はサーバーに送信しません",
  },
  en: {
    lang: "en",
    title: SITE_NAME,
    lead: "Convert, compress and make favicons — right in your browser.",
    note: "PNG / JPEG / WebP / GIF / SVG · Your images never leave your device",
  },
} as const;

function html(t: (typeof TEXT)[keyof typeof TEXT]): string {
  return `<!doctype html>
<html lang="${t.lang}">
<head><meta charset="utf-8"><style>
  * { margin: 0; box-sizing: border-box; }
  html, body { width: 1200px; height: 630px; }
  body {
    display: flex; flex-direction: column; justify-content: center; gap: 36px;
    padding: 0 96px; background: #ffffff; color: #0a0a0a;
    font-family: "Hiragino Sans", "Noto Sans JP", "Noto Sans CJK JP", system-ui, sans-serif;
    border-bottom: 24px solid #0a0a0a;
  }
  .brand { display: flex; align-items: center; gap: 32px; }
  .brand svg { width: 128px; height: 128px; }
  h1 { font-size: 88px; font-weight: 800; letter-spacing: -0.02em; }
  p.lead { font-size: 46px; font-weight: 700; line-height: 1.35; }
  p.note { font-size: 28px; color: #525252; }
</style></head>
<body>
  <div class="brand">${LOGO_SVG}<h1>${t.title}</h1></div>
  <p class="lead">${t.lead}</p>
  <p class="note">${t.note}</p>
</body>
</html>`;
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await mkdir(path.join(PUBLIC_DIR, "og"), { recursive: true });
  for (const t of Object.values(TEXT)) {
    await page.setContent(html(t));
    const file = path.join(PUBLIC_DIR, "og", `${t.lang}.png`);
    await page.screenshot({ path: file, type: "png" });
    console.log(path.relative(process.cwd(), file));
  }
} finally {
  await browser.close();
}
