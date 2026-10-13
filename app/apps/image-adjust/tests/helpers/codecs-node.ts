/**
 * Node（Vitest）で jSquash / libimagequant の WASM を動かすための準備。
 * ブラウザでは `new URL("*.wasm", import.meta.url)` を fetch するが、Node の fetch は file: を
 * 扱えないので、WASM を fs から読んで各モジュールの init() に渡す。
 * 併せて Node に無い ImageData を構造だけ用意する。
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

/** 解決できるモジュール（spec）のディレクトリからの相対パスで WASM を読む */
function wasm(spec: string, file: string): WebAssembly.Module {
  const root = path.dirname(require.resolve(spec));
  return new WebAssembly.Module(readFileSync(path.join(root, file)));
}

class NodeImageData {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
  readonly colorSpace = "srgb";
  constructor(data: Uint8ClampedArray | number, widthOrHeight: number, height?: number) {
    if (typeof data === "number") {
      this.width = data;
      this.height = widthOrHeight;
      this.data = new Uint8ClampedArray(this.width * this.height * 4);
    } else {
      this.data = data;
      this.width = widthOrHeight;
      this.height = height ?? data.length / 4 / widthOrHeight;
    }
  }
}

let ready: Promise<void> | undefined;

export function initCodecsForNode(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      if (typeof globalThis.ImageData === "undefined") {
        (globalThis as unknown as { ImageData: unknown }).ImageData = NodeImageData;
      }
      const [pngEnc, pngDec, jpegEnc, jpegDec, webpEnc, webpDec, oxipng, resize, quantize, liq] =
        await Promise.all([
          import("@jsquash/png/encode.js"),
          import("@jsquash/png/decode.js"),
          import("@jsquash/jpeg/encode.js"),
          import("@jsquash/jpeg/decode.js"),
          import("@jsquash/webp/encode.js"),
          import("@jsquash/webp/decode.js"),
          import("@jsquash/oxipng/optimise.js"),
          import("@jsquash/resize"),
          import("~/apps/image-adjust/lib/codecs/quantize"),
          import("libimagequant-wasm/wasm/libimagequant_wasm.js"),
        ]);
      await pngEnc.init(wasm("@jsquash/png/encode.js", "codec/pkg/squoosh_png_bg.wasm"));
      await pngDec.init(wasm("@jsquash/png/encode.js", "codec/pkg/squoosh_png_bg.wasm"));
      await jpegEnc.init(wasm("@jsquash/jpeg/encode.js", "codec/enc/mozjpeg_enc.wasm"));
      await jpegDec.init(wasm("@jsquash/jpeg/decode.js", "codec/dec/mozjpeg_dec.wasm"));
      await webpEnc.init(wasm("@jsquash/webp/encode.js", "codec/enc/webp_enc.wasm"));
      await webpDec.init(wasm("@jsquash/webp/decode.js", "codec/dec/webp_dec.wasm"));
      await oxipng.init(wasm("@jsquash/oxipng/optimise.js", "codec/pkg/squoosh_oxipng_bg.wasm"));
      await resize.initResize(
        wasm("@jsquash/resize/index.js", "lib/resize/pkg/squoosh_resize_bg.wasm"),
      );
      await liq.default({
        module_or_path: wasm(
          "libimagequant-wasm/wasm/libimagequant_wasm.js",
          "libimagequant_wasm_bg.wasm",
        ),
      });
      quantize.setQuantizerModule(liq);
    })();
  }
  return ready;
}

/** テスト用の RGBA 画像（グラデーション＋半透明の帯） */
export function makeImage(width: number, height: number, alpha = true) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = Math.round((x / Math.max(1, width - 1)) * 255);
      data[i + 1] = Math.round((y / Math.max(1, height - 1)) * 255);
      data[i + 2] = 128;
      data[i + 3] = alpha && y < height / 4 ? 96 : 255;
    }
  }
  return { data, width, height };
}

export function fixturePath(name: string): string {
  return path.resolve(import.meta.dirname, "../fixtures", name);
}

export function readFixture(name: string): ArrayBuffer {
  const buf = readFileSync(fixturePath(name));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}
