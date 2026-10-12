/**
 * scripts/generate-icons.ts が Playwright の Chromium の中で動かす入口（ブラウザ用。Vite で IIFE にバンドルする）。
 * アイコン生成ツール（/icons/）と同じ処理（loadIconSource → generateIconFiles）で、ロゴの SVG からアイコン一式を作る
 * （plan.md §6.1「このサイト自身のアイコン生成機能で作る」）。
 */
import { generateIconFiles } from "../../app/lib/icons/generate";
import { DEFAULT_ICON_SETTINGS, type IconSettings } from "../../app/lib/icons/settings";
import { loadIconSource } from "../../app/lib/icons/source";

export interface GeneratedIconFile {
  name: string;
  /** ファイルの中身（page.evaluate で Node に返すため数値の配列にする） */
  bytes: number[];
}

async function generateIcons(
  svgText: string,
  settings: Partial<IconSettings>,
): Promise<GeneratedIconFile[]> {
  const file = new File([svgText], "logo.svg", { type: "image/svg+xml" });
  const source = await loadIconSource(file);
  const files = await generateIconFiles(source, { ...DEFAULT_ICON_SETTINGS, ...settings });
  return files.map((f) => ({ name: f.name, bytes: Array.from(f.data) }));
}

Object.assign(globalThis, { __generateIcons: generateIcons });
