/**
 * アイコン一式の生成（ブラウザ専用。描画は render.ts、組み立ては ico.ts / manifest.ts / zip.ts）。
 * UI からも、サイト自身の PWA アイコン作成（plan.md §6.1）からも呼べるよう、React に依存させない。
 */
import { encodeIco } from "../core/ico";
import { serializeWebManifest } from "../core/manifest";
import { type IconSettings, sanitizeIconSettings } from "../core/settings";
import { FILE_NAMES, ICO_SIZES, OG_SPEC, PNG_SPECS, type PngSpec } from "../core/specs";
import { type DrawableSource, prepareSource, releasePreparedSource, renderIconPng } from "./render";
import { optimizeFaviconSvg, wrapFaviconSvg } from "./svg";
import type { IconFile } from "./zip";

export interface GenerateInput extends DrawableSource {
  isSvg?: boolean;
  /** 元画像が SVG のときの中身（favicon.svg に使う） */
  svgText?: string;
}

const textEncoder = new TextEncoder();

/** 生成するファイルの順番（ZIP・一覧の並び） */
export async function generateIconFiles(
  input: GenerateInput,
  rawSettings: IconSettings,
): Promise<IconFile[]> {
  // 縮小版は 1 回の生成につき 1 回だけ作り、全サイズで使い回す
  const source = { ...input, ...prepareSource(input) };
  try {
    return await generateFrom(source, sanitizeIconSettings(rawSettings));
  } finally {
    releasePreparedSource(source);
  }
}

async function generateFrom(source: GenerateInput, settings: IconSettings): Promise<IconFile[]> {
  const png = (spec: PngSpec): Promise<IconFile> =>
    renderIconPng(source, spec, settings).then((data) => ({
      name: spec.file,
      data,
      type: "image/png",
    }));

  const icoPngs = await Promise.all(
    ICO_SIZES.map((size) =>
      renderIconPng(source, { file: "", width: size, height: size, kind: "favicon" }, settings),
    ),
  );
  const files: IconFile[] = [
    { name: FILE_NAMES.ico, data: encodeIco(icoPngs), type: "image/x-icon" },
  ];

  if (source.isSvg && source.svgText) {
    const svg = wrapFaviconSvg(await optimizeFaviconSvg(source.svgText), settings, {
      width: source.width,
      height: source.height,
    });
    files.push({ name: FILE_NAMES.svg, data: textEncoder.encode(svg), type: "image/svg+xml" });
  }

  files.push(...(await Promise.all(PNG_SPECS.map(png))));

  files.push({
    name: FILE_NAMES.manifest,
    data: textEncoder.encode(serializeWebManifest(settings)),
    type: "application/manifest+json",
  });

  if (settings.includeOg) files.push(await png(OG_SPEC));
  return files;
}
