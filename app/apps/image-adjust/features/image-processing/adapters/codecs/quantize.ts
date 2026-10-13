/**
 * PNG の減色（§2.2）。第一候補は libimagequant（WASM）、読み込めない環境では image-q（純 JS）に落とす。
 * どちらも「RGBA → パレット化した PNG バイト列」を返し、呼び出し側が OxiPNG で詰める。
 */
import type { RasterImage } from "./raster";

type LiqModule = typeof import("libimagequant-wasm/wasm/libimagequant_wasm.js");

let liqPromise: Promise<LiqModule | null> | undefined;

/** libimagequant の WASM を読み込む。失敗したら null（以降は image-q を使う） */
async function loadLiq(): Promise<LiqModule | null> {
  if (!liqPromise) {
    liqPromise = (async () => {
      try {
        const mod = await import("libimagequant-wasm/wasm/libimagequant_wasm.js");
        const { default: wasmUrl } = await import(
          "libimagequant-wasm/wasm/libimagequant_wasm_bg.wasm?url"
        );
        await mod.default({ module_or_path: wasmUrl });
        return mod;
      } catch {
        return null;
      }
    })();
  }
  return liqPromise;
}

/**
 * テスト（Node）用：WASM を自前で読み込んだモジュールを差し込む。
 * ブラウザでは呼ばない（動的 import と ?url で解決する）。
 */
export function setQuantizerModule(mod: LiqModule | null): void {
  liqPromise = Promise.resolve(mod);
}

async function quantizeWithLiq(
  liq: LiqModule,
  image: RasterImage,
  colors: number,
): Promise<Uint8Array> {
  const q = new liq.ImageQuantizer();
  try {
    q.setMaxColors(colors);
    q.setSpeed(4);
    q.setQuality(0, 100);
    const result = q.quantizeImage(image.data, image.width, image.height);
    try {
      result.setDithering(1);
      const palette = result.getPalette();
      const indices = result.getPaletteIndices(image.data, image.width, image.height);
      return liq.encode_palette_to_png(indices, palette, image.width, image.height);
    } finally {
      result.free();
    }
  } finally {
    q.free();
  }
}

async function quantizeWithImageQ(image: RasterImage, colors: number): Promise<Uint8Array> {
  const iq = await import("image-q");
  const { encode } = await import("@jsquash/png");
  const container = iq.utils.PointContainer.fromUint8Array(
    new Uint8Array(image.data.buffer, image.data.byteOffset, image.data.byteLength),
    image.width,
    image.height,
  );
  const palette = iq.buildPaletteSync([container], { colors, colorDistanceFormula: "euclidean" });
  const reduced = iq.applyPaletteSync(container, palette, { imageQuantization: "floyd-steinberg" });
  const data = new Uint8ClampedArray(reduced.toUint8Array());
  // 色数は減っているので、OxiPNG が後段でパレット化する
  const png = await encode({ data, width: image.width, height: image.height } as ImageData);
  return new Uint8Array(png);
}

/** RGBA を colors 色（2〜256）に減色した PNG を返す */
export async function quantizeToPng(image: RasterImage, colors: number): Promise<ArrayBuffer> {
  const n = Math.min(256, Math.max(2, Math.round(colors)));
  const liq = await loadLiq();
  const bytes = liq ? await quantizeWithLiq(liq, image, n) : await quantizeWithImageQ(image, n);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
