/**
 * OGP 画像（1200×630）を作る（`nix develop -c node scripts/generate-og-images.ts`）。
 *
 * - アプリごと：app/apps/<id>/public/og/{ja,en}.png（アプリ名・説明は manifest.ts、アイコンは
 *   platform のアイコン対応表 app/platform/registry/icon-components.ts）
 * - サイト共通（ポータル・規約類・404）：public/og/{ja,en}.png（サイト名は app/platform/config の SITE_NAME、
 *   説明はポータルの manifest、下段に公開中のアプリ名）
 * - アプリが自前の生成スクリプト（app/apps/<id>/scripts/generate-og-images.ts）を持つなら、そのアプリは
 *   飛ばす（自前のデザインを優先し、既存の画像を上書きしない。例：Image Adjust のロゴ入りの画像）
 *
 * どのページがどの画像を使うかは app/platform/seo/meta.ts の buildPageMeta()（scripts/lib/app-og-images.ts）。
 * 文字（日本語を含む）を描くため、依存を増やさず、E2E 用に入っている Playwright の Chromium で
 * HTML を描画してスクリーンショットを撮る（ブラウザは Nix の devShell が供給する）。
 * デザインは Image Adjust の OGP（白地に黒、下端の太い帯、大きな見出し）に揃える。
 */
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_SITE_ORIGIN, SITE_NAME } from "../app/platform/config/index.ts";
import { APP_ICON_COMPONENTS } from "../app/platform/registry/icon-components.ts";
import type { AppIconKey } from "../app/platform/types.ts";
import {
  type AppEntry,
  appOgImageFile,
  loadApps,
  OG_LANGS,
  siteOgImageFile,
} from "./lib/app-og-images.ts";

type Lang = (typeof OG_LANGS)[number];

const ROOT = path.resolve(import.meta.dirname, "..");

interface OgText {
  lang: Lang;
  title: string;
  lead: string;
  note: string;
  icon: AppIconKey;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function iconSvg(icon: AppIconKey): string {
  const Icon = APP_ICON_COMPONENTS[icon];
  return renderToStaticMarkup(
    createElement(Icon, { size: 84, color: "#ffffff", strokeWidth: 1.75, "aria-hidden": true }),
  );
}

function html(t: OgText): string {
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
  .tile {
    flex: none; display: flex; align-items: center; justify-content: center;
    width: 128px; height: 128px; border-radius: 28px; background: #0a0a0a;
  }
  h1 { font-size: 80px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.1; }
  p.lead { font-size: 46px; font-weight: 700; line-height: 1.35; }
  p.note { font-size: 28px; color: #525252; }
</style></head>
<body>
  <div class="brand"><div class="tile">${iconSvg(t.icon)}</div><h1>${escapeHtml(t.title)}</h1></div>
  <p class="lead">${escapeHtml(t.lead)}</p>
  <p class="note">${escapeHtml(t.note)}</p>
</body>
</html>`;
}

const host = new URL(DEFAULT_SITE_ORIGIN).host;

function appText(app: AppEntry, lang: Lang): OgText {
  return {
    lang,
    title: app.manifest.name[lang] ?? app.manifest.id,
    lead: app.manifest.description[lang] ?? "",
    note: `${SITE_NAME[lang]} ・ ${host}`,
    icon: app.manifest.icon as AppIconKey,
  };
}

function siteText(apps: AppEntry[], lang: Lang): OgText {
  const portal = apps.find((app) => !app.manifest.path);
  const listed = apps
    .filter((app) => app.manifest.path && app.manifest.status !== "hidden")
    .map((app) => app.manifest.name[lang]);
  return {
    lang,
    title: SITE_NAME[lang],
    lead: portal?.manifest.description[lang] ?? "",
    note: listed.length > 0 ? listed.join(" ・ ") : host,
    icon: (portal?.manifest.icon as AppIconKey | undefined) ?? "grid",
  };
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

const apps = await loadApps(ROOT);
const jobs: { file: string; text: OgText }[] = OG_LANGS.map((lang) => ({
  file: siteOgImageFile(ROOT, lang),
  text: siteText(apps, lang),
}));
for (const app of apps) {
  if (!app.manifest.path) continue;
  if (await exists(path.join(app.dir, "scripts", "generate-og-images.ts"))) {
    console.log(`skip: ${app.manifest.id}（自前の generate-og-images.ts を使う）`);
    continue;
  }
  for (const lang of OG_LANGS)
    jobs.push({ file: appOgImageFile(app.dir, lang), text: appText(app, lang) });
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  for (const { file, text } of jobs) {
    await mkdir(path.dirname(file), { recursive: true });
    await page.setContent(html(text));
    await page.screenshot({ path: file, type: "png" });
    console.log(path.relative(process.cwd(), file));
  }
} finally {
  await browser.close();
}
