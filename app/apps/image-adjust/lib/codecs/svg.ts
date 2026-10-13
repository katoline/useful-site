/**
 * SVG の最適化（SVGO のブラウザ版。§2.2）。
 * サイズはバイト数でしか表せないので、目標サイズではなく 3 段階のレベルを選ばせる。
 * 出力はテキストとして扱い、プレビューは <img> 経由でのみ表示する（§3.6）。
 */
import type { Config } from "svgo/browser";

export type SvgLevel = "safe" | "standard" | "aggressive";

export const SVG_LEVELS: readonly SvgLevel[] = ["safe", "standard", "aggressive"];

function configFor(level: SvgLevel): Config {
  switch (level) {
    case "safe":
      // 見た目に影響しうる変換は止め、メタデータ・コメント・エディタ固有属性の除去だけにする
      return {
        multipass: false,
        plugins: [
          {
            name: "preset-default",
            params: {
              overrides: {
                cleanupIds: false,
                convertShapeToPath: false,
                mergePaths: false,
                convertPathData: false,
                cleanupNumericValues: false,
                removeUnknownsAndDefaults: false,
                removeHiddenElems: false,
              },
            },
          },
        ],
      };
    case "standard":
      // 既定のプラグイン一式（SVGO 4 の preset-default は viewBox を残す）
      return { multipass: true, plugins: ["preset-default"] };
    case "aggressive":
      // 数値精度を落とし、何度も通す（width / height は <img> の固有サイズに要るので残す）
      return {
        multipass: true,
        floatPrecision: 2,
        plugins: [
          {
            name: "preset-default",
            params: {
              overrides: {
                cleanupNumericValues: { floatPrecision: 2 },
                convertPathData: { floatPrecision: 2 },
                convertTransform: { floatPrecision: 2 },
              },
            },
          },
        ],
      };
  }
}

export async function optimizeSvg(source: string, level: SvgLevel): Promise<string> {
  const { optimize } = await import("svgo/browser");
  const result = optimize(source, configFor(level));
  return result.data;
}
