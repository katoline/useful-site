/**
 * GIF の最適化（gifsicle の WASM 版。§2.2）。アニメーション GIF のフレームは維持する。
 *
 * gifsicle-wasm-browser は自前で Web Worker を立てて処理する（Blob URL の Worker）ので、
 * この関数はメインスレッドから呼ぶ（Worker の中からは呼ばない）。
 */

export interface GifOptions {
  /** 最適化レベル 1〜3（3 は大きなファイルで極端に遅くなる） */
  level: 1 | 2 | 3;
  /** 非可逆度 0〜200（0 で可逆。30〜60 がバランス） */
  lossy: number;
  /** 色数 2〜256。null なら変えない */
  colors: number | null;
  /** リサイズ後のサイズ。null なら変えない */
  resize: { width: number; height: number } | null;
}

export const DEFAULT_GIF_OPTIONS: GifOptions = { level: 2, lossy: 30, colors: null, resize: null };

function buildCommand(o: GifOptions): string {
  const parts = [`-O${o.level}`];
  if (o.lossy > 0) parts.push(`--lossy=${Math.min(200, Math.round(o.lossy))}`);
  if (o.colors != null) parts.push(`--colors ${Math.min(256, Math.max(2, Math.round(o.colors)))}`);
  if (o.resize) parts.push(`--resize ${Math.round(o.resize.width)}x${Math.round(o.resize.height)}`);
  // メタデータ（コメント・アプリ拡張の余分）は -O の最適化で落ちる。入力は 1 件固定
  parts.push("--no-comments", "--no-names", "in.gif", "-o", "/out/out.gif");
  return parts.join(" ");
}

export async function optimizeGif(input: ArrayBuffer, options: GifOptions): Promise<ArrayBuffer> {
  const { default: gifsicle } = await import("gifsicle-wasm-browser");
  const files = await gifsicle.run({
    input: [{ file: input, name: "in.gif" }],
    command: [buildCommand(options)],
  });
  const out = files?.[0];
  if (!out) throw new Error("gifsicle produced no output");
  return out.arrayBuffer();
}
