/**
 * Web 用最適化プリセットと、レスポンシブ書き出しの <picture> / srcset スニペット（§2.5）。
 */
import { EXTENSION, type ImageFormat } from "../codecs/format";
import { stripExtension } from "./naming";
import type { ProcessSettings } from "./types";

export type PresetId = "lp-hero" | "blog-thumb" | "og-image" | "responsive";

export interface ToolPreset {
  id: PresetId;
  /** 設定の上書き分だけ持つ */
  settings: Partial<ProcessSettings>;
}

export const RESPONSIVE_WIDTHS = [640, 1280, 1920] as const;

const NO_RESIZE: ProcessSettings["resize"] = {
  mode: "none",
  width: null,
  height: null,
  percent: 100,
  keepAspect: true,
  noEnlarge: true,
};

function widthResize(width: number): ProcessSettings["resize"] {
  return { ...NO_RESIZE, mode: "px", width };
}

export const PRESETS: readonly ToolPreset[] = [
  {
    // LP のヒーロー画像：幅 1920 / WebP / 300KB 以下
    id: "lp-hero",
    settings: {
      output: "webp",
      sizeMode: "target",
      targetBytes: 300 * 1024,
      resize: widthResize(1920),
      responsiveWidths: [],
    },
  },
  {
    // ブログのサムネイル：幅 1200 / WebP
    id: "blog-thumb",
    settings: {
      output: "webp",
      sizeMode: "quality",
      quality: 80,
      resize: widthResize(1200),
      responsiveWidths: [],
    },
  },
  {
    // OGP 画像：幅 1200 / JPEG（SNS 側が WebP を扱えないことがある）
    id: "og-image",
    settings: {
      output: "jpeg",
      sizeMode: "quality",
      quality: 85,
      resize: widthResize(1200),
      responsiveWidths: [],
    },
  },
  {
    // レスポンシブ：640 / 1280 / 1920 の WebP を一度に書き出す
    id: "responsive",
    settings: {
      output: "webp",
      sizeMode: "quality",
      quality: 80,
      resize: NO_RESIZE,
      responsiveWidths: [...RESPONSIVE_WIDTHS],
    },
  },
];

export function findPreset(id: string): ToolPreset | undefined {
  return PRESETS.find((p) => p.id === id);
}

export function responsiveFileName(inputName: string, format: ImageFormat, width: number): string {
  return `${stripExtension(inputName)}-${width}w.${EXTENSION[format]}`;
}

/** 実際に書き出した 1 本（ファイル名と実寸） */
export interface SnippetVariant {
  file: string;
  width: number;
  height: number | null;
}

export interface SnippetInput {
  format: ImageFormat;
  variants: SnippetVariant[];
  /** sizes 属性。省略時は "100vw" */
  sizes?: string;
  alt?: string;
}

/** 属性値として安全にする：URL として符号化してから " ' < > & を逃がす */
function attrUrl(file: string): string {
  return escapeAttr(encodeURI(file));
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function sortVariants(variants: SnippetVariant[]): SnippetVariant[] {
  const byWidth = new Map<number, SnippetVariant>();
  for (const v of variants) if (!byWidth.has(v.width)) byWidth.set(v.width, v);
  return [...byWidth.values()].sort((a, b) => a.width - b.width);
}

function sizeAttrs(fallback: SnippetVariant): string[] {
  const attrs = [`width="${fallback.width}"`];
  if (fallback.height) attrs.push(`height="${fallback.height}"`);
  return attrs;
}

function srcsetValue(variants: SnippetVariant[]): string {
  return variants.map((v) => `${attrUrl(v.file)} ${v.width}w`).join(", ");
}

/** <img srcset="..." sizes="..."> のスニペット。フォールバックは最大幅の実ファイル */
export function srcsetSnippet(input: SnippetInput): string {
  const variants = sortVariants(input.variants);
  const fallback = variants[variants.length - 1];
  if (!fallback) return "";
  const attrs = [
    `src="${attrUrl(fallback.file)}"`,
    `srcset="${srcsetValue(variants)}"`,
    `sizes="${escapeAttr(input.sizes ?? "100vw")}"`,
    ...sizeAttrs(fallback),
    `alt="${escapeAttr(input.alt ?? "")}"`,
    'loading="lazy"',
    'decoding="async"',
  ];
  return `<img\n  ${attrs.join("\n  ")}\n>`;
}

/**
 * <picture> のスニペット。<source> は書き出した形式の srcset、<img> は実際に書き出した最大幅の
 * ファイルを指す（別形式のフォールバックは書き出していないので作らない）。
 */
export function pictureSnippet(input: SnippetInput): string {
  const variants = sortVariants(input.variants);
  const fallback = variants[variants.length - 1];
  if (!fallback) return "";
  const sizes = escapeAttr(input.sizes ?? "100vw");
  const imgAttrs = [
    `src="${attrUrl(fallback.file)}"`,
    ...sizeAttrs(fallback),
    `alt="${escapeAttr(input.alt ?? "")}"`,
    'loading="lazy"',
    'decoding="async"',
  ];
  return [
    "<picture>",
    `  <source type="${mimeFor(input.format)}" srcset="${srcsetValue(variants)}" sizes="${sizes}">`,
    `  <img ${imgAttrs.join(" ")}>`,
    "</picture>",
  ].join("\n");
}

function mimeFor(format: ImageFormat): string {
  return format === "svg" ? "image/svg+xml" : `image/${format}`;
}
