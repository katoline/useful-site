/**
 * 画像 1 件の処理本体：判定 → デコード → リサイズ → エンコード（目標サイズの探索）。
 * Web Worker・メインスレッド・Node（テスト）のどこでも動く純粋な関数。
 * UI からは ImageProcessor（processor.ts）経由で呼ぶ。
 */

import { detectFormatWithHints, type ImageFormat, type RasterFormat } from "../../../domain/format";
import { outputFileName, outputPath } from "../../../domain/naming";
import { readDimensions } from "../core/dimensions";
import { searchTargetSize } from "../core/target-size";
import {
  ProcessError,
  type ProcessInput,
  type ProcessOutput,
  type ProcessResult,
  type ProcessSettings,
  type ProcessWarning,
  type ResizeSettings,
} from "../core/types";
import { DEFAULT_GIF_OPTIONS, optimizeGif } from "./codecs/gif";
import { embedIcc, extractIcc, isAnimatedWebp, stripMetadata } from "./codecs/metadata";
import {
  decodeRaster,
  encodeRaster,
  flattenOnColor,
  hasTransparency,
  type RasterImage,
  resizeImage,
} from "./codecs/raster";
import { optimizeSvg } from "./codecs/svg";

export interface ProcessLimits {
  maxPixels: number;
}

/** 品質 1〜100 を PNG の色数 2〜256 に対応づける（品質モード・目標サイズ探索の両方で使う） */
export function pngColorsForLevel(level: number): number {
  const l = Math.min(100, Math.max(1, level));
  return Math.min(256, Math.max(2, Math.round(2 ** (1 + (l / 100) * 7))));
}

/** リサイズ後のサイズ。変えないときは元のサイズ。noEnlarge なら元より大きくしない */
export function resolveResize(
  width: number,
  height: number,
  r: ResizeSettings,
): { width: number; height: number } {
  const clamp = (v: number) => Math.max(1, Math.round(v));
  let target = { width, height };
  if (r.mode === "percent") {
    const s = Math.min(100, Math.max(1, r.percent)) / 100;
    target = { width: clamp(width * s), height: clamp(height * s) };
  } else if (r.mode === "px") {
    const w = r.width && r.width > 0 ? r.width : null;
    const h = r.height && r.height > 0 ? r.height : null;
    if (w && h) {
      if (r.keepAspect) {
        // 両方指定ならはみ出さない大きさに収める
        const s = Math.min(w / width, h / height);
        target = { width: clamp(width * s), height: clamp(height * s) };
      } else {
        target = { width: clamp(w), height: clamp(h) };
      }
    } else if (w) {
      target = { width: clamp(w), height: clamp((height * w) / width) };
    } else if (h) {
      target = { width: clamp((width * h) / height), height: clamp(h) };
    }
  }
  if (r.noEnlarge) {
    if (r.mode === "px" && !r.keepAspect && r.width && r.height) {
      target = { width: Math.min(target.width, width), height: Math.min(target.height, height) };
    } else {
      const s = Math.min(1, width / target.width, height / target.height);
      if (s < 1) target = { width: clamp(target.width * s), height: clamp(target.height * s) };
    }
  }
  return target;
}

function output(
  input: ProcessInput,
  format: ImageFormat,
  bytes: ArrayBuffer,
  extra: Partial<ProcessOutput> = {},
): ProcessOutput {
  const variantWidth = extra.variantWidth ?? null;
  return {
    name: outputFileName(input.name, format, variantWidth),
    path: outputPath(input.path, format, variantWidth),
    format,
    bytes,
    width: null,
    height: null,
    quality: null,
    variantWidth,
    ...extra,
  };
}

/** 元のまま返すとき：stripMetadata ならメタデータだけ取り除く（ICC は残る） */
function keepOriginal(
  input: ProcessInput,
  format: ImageFormat,
  settings: ProcessSettings,
): ArrayBuffer {
  return settings.stripMetadata ? stripMetadata(format, input.bytes) : input.bytes.slice(0);
}

function assertPixels(width: number, height: number, limits?: ProcessLimits): void {
  if (limits && width * height > limits.maxPixels) throw new ProcessError("too_many_pixels");
}

export async function processImage(
  input: ProcessInput,
  settings: ProcessSettings,
  limits?: ProcessLimits,
): Promise<ProcessResult> {
  const format = detectFormatWithHints(input.bytes, { name: input.name, type: input.type });
  if (!format) throw new ProcessError("unsupported");
  const dims = readDimensions(format, input.bytes);
  if (dims) assertPixels(dims.width, dims.height, limits);
  const base = {
    id: input.id,
    inputFormat: format,
    inputBytes: input.bytes.byteLength,
    inputWidth: dims?.width ?? null,
    inputHeight: dims?.height ?? null,
  };
  const warnings: ProcessWarning[] = [];
  const finish = (outputs: ProcessOutput[]): ProcessResult => ({
    ...base,
    outputs,
    warnings: [...new Set(warnings)],
  });

  if (format === "svg") {
    if (settings.output !== "same") warnings.push("svg_kept");
    const bytes = await processSvg(input, settings, warnings);
    return finish([output(input, "svg", bytes)]);
  }

  if (format === "gif") {
    if (settings.output !== "same") warnings.push("gif_kept");
    const resized = dims ? resolveResize(dims.width, dims.height, settings.resize) : null;
    const bytes = await processGif(input, settings, resized, dims, warnings);
    const info = readDimensions("gif", bytes);
    return finish([
      output(input, "gif", bytes, { width: info?.width ?? null, height: info?.height ?? null }),
    ]);
  }

  if (format === "webp" && isAnimatedWebp(input.bytes)) {
    // アニメーション WebP は対象外：元のまま（メタデータだけ除去）
    warnings.push("animated_webp");
    return finish([
      output(input, "webp", keepOriginal(input, "webp", settings), {
        width: dims?.width ?? null,
        height: dims?.height ?? null,
      }),
    ]);
  }

  const outputs = await processRaster(input, format, settings, warnings, limits);
  return finish(outputs);
}

async function processSvg(
  input: ProcessInput,
  settings: ProcessSettings,
  warnings: ProcessWarning[],
): Promise<ArrayBuffer> {
  const source = new TextDecoder("utf-8").decode(input.bytes);
  let optimized: string;
  try {
    optimized = await optimizeSvg(source, settings.svgLevel);
  } catch {
    throw new ProcessError("encode_failed");
  }
  const bytes = new TextEncoder().encode(optimized);
  if (bytes.byteLength >= input.bytes.byteLength) {
    warnings.push("kept_original");
    return keepOriginal(input, "svg", settings);
  }
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function processGif(
  input: ProcessInput,
  settings: ProcessSettings,
  resized: { width: number; height: number } | null,
  dims: { width: number; height: number } | null,
  warnings: ProcessWarning[],
): Promise<ArrayBuffer> {
  const changesSize =
    !!resized && !!dims && (resized.width !== dims.width || resized.height !== dims.height);
  let bytes: ArrayBuffer;
  try {
    bytes = await optimizeGif(input.bytes, {
      ...DEFAULT_GIF_OPTIONS,
      ...settings.gif,
      resize: changesSize ? resized : null,
    });
  } catch {
    throw new ProcessError("encode_failed");
  }
  if (settings.stripMetadata) bytes = stripMetadata("gif", bytes);
  if (!changesSize && bytes.byteLength >= input.bytes.byteLength) {
    warnings.push("kept_original");
    return keepOriginal(input, "gif", settings);
  }
  return bytes;
}

async function processRaster(
  input: ProcessInput,
  format: RasterFormat,
  settings: ProcessSettings,
  warnings: ProcessWarning[],
  limits?: ProcessLimits,
): Promise<ProcessOutput[]> {
  const outFormat: RasterFormat = settings.output === "same" ? format : settings.output;
  // 再エンコードで落ちるので、ICC（色）は出力に埋め込み直す。EXIF 等は落ちる
  const icc = extractIcc(format, input.bytes);
  if (!settings.stripMetadata) warnings.push("metadata_dropped");

  let image: RasterImage;
  try {
    image = await decodeRaster(format, input.bytes);
  } catch {
    throw new ProcessError("decode_failed");
  }
  const target = resolveResize(image.width, image.height, settings.resize);
  assertPixels(target.width, target.height, limits);
  const resizes =
    settings.resize.mode !== "none" &&
    (target.width !== image.width || target.height !== image.height);

  const withIcc = (bytes: ArrayBuffer) => (icc ? embedIcc(outFormat, bytes, icc) : bytes);

  // レスポンシブ幅：元より小さい幅だけ。元が最大幅より狭ければ元の幅の版も出す
  const requested = [...new Set(settings.responsiveWidths)].filter((w) => w > 0);
  const widths = requested.filter((w) => w < image.width).sort((a, b) => a - b);
  if (requested.some((w) => w >= image.width)) widths.push(image.width);

  if (widths.length === 0) {
    const resized = resizes ? await resizeImage(image, target.width, target.height) : image;
    const encoded = await encodeWithSettings(resized, outFormat, settings, warnings);
    // 同じ形式・同じサイズで大きくなるなら元のまま（メタデータの除去だけ行う）
    if (outFormat === format && !resizes && encoded.bytes.byteLength >= input.bytes.byteLength) {
      warnings.push("kept_original");
      return [
        output(input, format, keepOriginal(input, format, settings), {
          width: image.width,
          height: image.height,
        }),
      ];
    }
    return [
      output(input, outFormat, withIcc(encoded.bytes), {
        width: resized.width,
        height: resized.height,
        quality: encoded.quality,
      }),
    ];
  }

  const outputs: ProcessOutput[] = [];
  for (const w of widths) {
    const h = Math.max(1, Math.round((image.height * w) / image.width));
    const resized = w === image.width ? image : await resizeImage(image, w, h);
    const encoded = await encodeWithSettings(resized, outFormat, settings, warnings);
    outputs.push(
      output(input, outFormat, withIcc(encoded.bytes), {
        width: resized.width,
        height: resized.height,
        quality: encoded.quality,
        variantWidth: w,
      }),
    );
  }
  return outputs;
}

async function encodeWithSettings(
  image: RasterImage,
  outFormat: RasterFormat,
  settings: ProcessSettings,
  warnings: ProcessWarning[],
): Promise<{ bytes: ArrayBuffer; quality: number | null }> {
  // 透過 → JPEG は背景色で塗る（§2.1）
  const source =
    outFormat === "jpeg" && hasTransparency(image)
      ? flattenOnColor(image, settings.jpegBackground)
      : image;

  const encodeAt = (level: number) => {
    switch (outFormat) {
      case "jpeg":
        return encodeRaster(source, {
          format: "jpeg",
          quality: level,
          progressive: settings.jpegProgressive,
        });
      case "webp":
        return encodeRaster(source, { format: "webp", quality: level });
      case "png":
        return encodeRaster(source, { format: "png", colors: pngColorsForLevel(level) });
    }
  };

  try {
    if (settings.sizeMode === "target") {
      const result = await searchTargetSize(encodeAt, settings.targetBytes, { min: 5, max: 100 });
      if (!result.reached) warnings.push("target_unreachable");
      return { bytes: result.bytes, quality: result.level };
    }
    switch (outFormat) {
      case "jpeg":
        return { bytes: await encodeAt(settings.quality), quality: settings.quality };
      case "webp":
        if (settings.webpLossless) {
          return {
            bytes: await encodeRaster(source, { format: "webp", quality: 100, lossless: true }),
            quality: null,
          };
        }
        return { bytes: await encodeAt(settings.quality), quality: settings.quality };
      case "png":
        // 可逆なら減色しない。非可逆なら品質を色数（2〜256）に対応づける
        if (settings.pngLossless) {
          return {
            bytes: await encodeRaster(source, { format: "png", colors: null }),
            quality: null,
          };
        }
        return { bytes: await encodeAt(settings.quality), quality: settings.quality };
    }
  } catch (e) {
    if (e instanceof ProcessError) throw e;
    throw new ProcessError("encode_failed", e instanceof Error ? e.message : undefined);
  }
}
