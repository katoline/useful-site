import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { readGifInfo } from "../../../tests/helpers/gif-info";
import { readFixture } from "./helpers/codecs-node";

/** 古いEmscriptenのdata:読み込みも再現する。ネットワーク通信は許可しない。 */
class InlineRequest {
  url = "";
  response: ArrayBuffer = new ArrayBuffer(0);
  status = 0;
  readyState = 0;
  onload?: () => void;
  onreadystatechange?: () => void;

  open(_method: string, url: string) {
    if (!/^data:application\/(?:octet-stream|wasm);base64,/.test(url)) {
      throw new Error("External requests are disabled in the codec test");
    }
    this.url = url;
  }

  send() {
    const bytes = Buffer.from(this.url.slice(this.url.indexOf(",") + 1), "base64");
    this.response = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    this.status = 200;
    this.readyState = 4;
    this.onload?.();
    this.onreadystatechange?.();
  }
}

interface GifOutput {
  name: string;
  file: Uint8Array;
}

/** 配布するWorker/WASMそのものを実行し、パッケージの表示版だけで判定しない。 */
async function runGif(command: string, input?: ArrayBuffer) {
  const { default: gifsicle } = await import("gifsicle-wasm-browser");
  const worker = (gifsicle as unknown as { tool: { workerLocalUrl: string } }).tool.workerLocalUrl;
  const lines: string[] = [];
  let finish: (outputs: GifOutput[] | null) => void = () => {};
  const result = new Promise<GifOutput[] | null>((resolve) => {
    finish = resolve;
  });
  const log = (...parts: unknown[]) => lines.push(parts.join(" "));
  const scope: Record<string, unknown> = {
    console: { log, warn: log, error: log },
    XMLHttpRequest: InlineRequest,
    WebAssembly,
    atob,
    btoa,
    TextDecoder,
    TextEncoder,
    setTimeout,
    clearTimeout,
    importScripts: () => {
      throw new Error("External scripts are disabled in the codec test");
    },
    location: { href: "https://example.invalid/worker.js" },
    postMessage: finish,
  };
  scope.self = scope;
  runInNewContext(worker, scope, { timeout: 5000 });
  const onmessage = scope.onmessage as (event: { data: unknown }) => Promise<void>;
  await onmessage({
    data: {
      data: input ? [{ name: "in.gif", file: input }] : [],
      command: [command],
      folder: [],
    },
  });
  return { lines, outputs: await result };
}

describe("GIF WASMのセキュリティ更新", () => {
  it("実際のCLIがメモリ安全性修正版Gifsicle 1.98以降を返す", async () => {
    const { lines } = await runGif("--version");
    const version = /LCDF Gifsicle (\d+)\.(\d+)/.exec(lines.join("\n"));
    expect(version).not.toBeNull();
    expect(Number(version?.[1]) * 1000 + Number(version?.[2])).toBeGreaterThanOrEqual(1098);
  });

  it("実WASMで最適化してもアニメーションのフレームを維持する", async () => {
    const input = readFixture("animated.gif");
    const { outputs } = await runGif(
      "-O2 --lossy=30 --no-comments --no-names in.gif -o /out/out.gif",
      input,
    );
    expect(outputs).toHaveLength(1);
    const file = outputs?.[0]?.file;
    expect(file).toBeDefined();
    const bytes = Uint8Array.from(file ?? []).buffer;
    expect(readGifInfo(bytes)?.frames).toBe(readGifInfo(input)?.frames);
  });

  it("リサイズと減色を併用してもフレームを維持する", async () => {
    const input = readFixture("animated.gif");
    const { outputs } = await runGif(
      "-O2 --lossy=30 --colors 64 --resize 80x60 --no-comments --no-names in.gif -o /out/out.gif",
      input,
    );
    const file = outputs?.[0]?.file;
    expect(file).toBeDefined();
    const info = readGifInfo(Uint8Array.from(file ?? []).buffer);
    expect(info?.width).toBe(80);
    expect(info?.height).toBe(60);
    expect(info?.frames).toBe(readGifInfo(input)?.frames);
  });
});
