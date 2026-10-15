/**
 * QR の符号化と SVG 生成。
 * `qrcode`（純 JavaScript）は使う瞬間に動的 import し、誤り訂正 H のモジュール行列から
 * 固定の SVG 要素を組み立てる。ユーザーが入力した URL は SVG の文字列には入らない
 * （符号化した行列と、検証済みの色・数値・アイコンだけを使う）。
 */
import {
  QR_ERROR_CORRECTION_LEVEL,
  type QrSettings,
  SVG_INTRINSIC_SIZE,
} from "../../../domain/qr-settings";
import { type CenterIconInput, normalizeCenterIcon } from "../core/icon";
import { buildQrLayout, type QrMatrixLike } from "../core/layout";
import { buildQrSvg } from "../core/svg";

/** モジュール行列を作る窓口（ライブラリは adapters に閉じ込める） */
export interface QrEncoder {
  encode(text: string): QrMatrixLike;
}

export type LoadQrEncoder = () => Promise<QrEncoder>;

/** `qrcode` を動的 import して誤り訂正 H の行列を得る実装 */
export const loadQrcodeEncoder: LoadQrEncoder = async () => {
  const QRCode = await import("qrcode");
  return {
    encode(text: string): QrMatrixLike {
      const { modules } = QRCode.create(text, {
        errorCorrectionLevel: QR_ERROR_CORRECTION_LEVEL,
      });
      return {
        size: modules.size,
        isDark: (row: number, col: number) => modules.get(row, col) === 1,
      };
    },
  };
};

export interface GeneratedQr {
  /** 固定要素だけで作った SVG 文字列 */
  svg: string;
  /** 保存・プレビュー用の Blob */
  svgBlob: Blob;
  /** 余白を含まないモジュール数 */
  moduleCount: number;
  /** 余白を含む一辺のモジュール数 */
  extent: number;
  quietZone: number;
  /** 中央にアイコンを埋め込んだか */
  hasIcon: boolean;
}

export type GenerateQrSvg = (
  text: string,
  settings: QrSettings,
  icon?: CenterIconInput | null,
) => Promise<GeneratedQr>;

/** 符号化器を差し替えられる形で生成器を作る（通常は既定の実装を使う） */
export function createQrSvgGenerator(
  loadEncoder: LoadQrEncoder = loadQrcodeEncoder,
): GenerateQrSvg {
  return async function generateQrSvg(text, settings, icon) {
    const encoder = await loadEncoder();
    const matrix = encoder.encode(text);
    const normalized = normalizeCenterIcon(icon ?? { kind: "none" });
    const hasIcon = normalized.kind !== "none";

    const layout = buildQrLayout(matrix, {
      iconSizePercent: hasIcon ? settings.iconSizePercent : null,
    });
    const svg = buildQrSvg({
      layout,
      foreground: settings.foreground,
      icon: normalized,
      intrinsicSize: SVG_INTRINSIC_SIZE,
      // 選択した PNG サイズでモジュール幅が整数画素になるよう中央へ縮小する
      pixelGridSize: settings.pngSize,
    });

    return {
      svg,
      svgBlob: new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
      moduleCount: layout.moduleCount,
      extent: layout.extent,
      quietZone: layout.quietZone,
      hasIcon,
    };
  };
}

/** 既定の生成器 */
export const generateQrSvg: GenerateQrSvg = createQrSvgGenerator();
