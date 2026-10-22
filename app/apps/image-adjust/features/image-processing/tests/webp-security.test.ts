import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { expect, it } from "vitest";

const require = createRequire(import.meta.url);

type VersionedCodec = (options: { wasmBinary: Uint8Array }) => Promise<{ version(): number }>;

it.each(["enc/webp_enc", "dec/webp_dec"])(
  "WebP %sが修正版libwebpを実行する（npm版だけでは判定しない）",
  async (codec) => {
    const specifier = `@jsquash/webp/codec/${codec}.js`;
    const filename = require.resolve(specifier);
    const { default: createCodec } = (await import(/* @vite-ignore */ filename)) as {
      default: VersionedCodec;
    };
    const instance = await createCodec({
      wasmBinary: readFileSync(path.join(path.dirname(filename), `${path.basename(codec)}.wasm`)),
    });
    // WebPGet{Encoder,Decoder}Versionはmajor<<16 | minor<<8 | patchを返す。
    expect(instance.version()).toBeGreaterThanOrEqual(0x010600);
  },
);
