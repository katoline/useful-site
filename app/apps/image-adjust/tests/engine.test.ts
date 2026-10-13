import { zipSync } from "fflate";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addZipFile,
  bindContext,
  type EngineContext,
  loadSource,
  maxPendingItems,
  pendingCount,
  planZipParts,
  readItems,
  scheduleReprocess,
  setProcessorForTests,
  syncWithSettings,
} from "~/apps/image-adjust/components/tools/engine";
import { LIMITS } from "~/apps/image-adjust/lib/limits";
import {
  DEFAULT_SETTINGS,
  type ImageProcessor,
  type ProcessInput,
  type ProcessResult,
} from "~/apps/image-adjust/lib/pipeline/types";
import { ToolSessionStore } from "~/platform/state/ToolSessionProvider";
import { readFixture } from "./helpers/codecs-node";

const png = new Uint8Array(readFixture("sample.png"));

/** 少し待ってから「処理済み」を返す偽の処理。呼ばれた瞬間の未処理数を記録する */
function fakeProcessor(store: ToolSessionStore, delayMs = 5) {
  const observed: number[] = [];
  const calls: ProcessInput[] = [];
  const processor: ImageProcessor = {
    async process(input, settings) {
      observed.push(pendingCount(store));
      calls.push(input);
      await new Promise((r) => setTimeout(r, delayMs));
      const result: ProcessResult = {
        id: input.id,
        inputFormat: "png",
        inputBytes: input.bytes.byteLength,
        inputWidth: 160,
        inputHeight: 120,
        outputs: [
          {
            name: input.name,
            path: input.path,
            format: "png",
            bytes: input.bytes.slice(0, 100),
            width: 160,
            height: 120,
            quality: settings.quality,
            variantWidth: null,
          },
        ],
        warnings: [],
      };
      return result;
    },
    cancelPending() {},
    dispose() {},
  };
  return { processor, observed, calls };
}

function zipFile(count: number): File {
  const files: Record<string, Uint8Array> = {};
  for (let i = 0; i < count; i++) files[`dir/img${String(i).padStart(2, "0")}.png`] = png;
  return new File([zipSync(files, { level: 0 }) as BlobPart], "many.zip", {
    type: "application/zip",
  });
}

async function waitUntil(cond: () => boolean, timeoutMs = 10_000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error("timeout");
    await new Promise((r) => setTimeout(r, 5));
  }
}

describe("ZIP の展開のバックプレッシャー（§5）", () => {
  let store: ToolSessionStore;
  let ctx: EngineContext;

  beforeEach(() => {
    store = new ToolSessionStore();
    ctx = {
      store,
      limits: LIMITS.desktop,
      settings: DEFAULT_SETTINGS,
      formatBytes: (b) => `${b} B`,
    };
    bindContext(ctx);
  });

  afterEach(() => {
    setProcessorForTests(null);
  });

  it("同時に抱える未処理の項目数が上限以下に収まり、全件処理される", async () => {
    const { processor, observed } = fakeProcessor(store);
    setProcessorForTests(processor);
    const total = 25;
    let maxPending = 0;
    const unsubscribe = store.subscribe("tool:items", () => {
      maxPending = Math.max(maxPending, pendingCount(store));
    });

    await addZipFile(ctx, zipFile(total));
    await waitUntil(() => readItems(store).every((it) => it.status === "done"));
    unsubscribe();

    expect(readItems(store)).toHaveLength(total);
    expect(maxPending).toBeLessThanOrEqual(maxPendingItems());
    expect(Math.max(...observed)).toBeLessThanOrEqual(maxPendingItems());
    // 展開はすぐには終わらず、処理の進みに合わせて進む（最初の 1 件が処理されるまでに全件は展開されない）
    expect(maxPending).toBeLessThan(total);
  }, 20_000);

  it("ZIP 由来の項目は処理後に元データを解放し、必要なら ZIP から読み直せる", async () => {
    const { processor } = fakeProcessor(store);
    setProcessorForTests(processor);
    await addZipFile(ctx, zipFile(3));
    await waitUntil(() => readItems(store).every((it) => it.status === "done"));

    const items = readItems(store);
    for (const it of items) {
      expect(it.source).toBeNull();
      expect(it.origin?.entryName).toMatch(/^dir\/img0\d\.png$/);
      expect(it.path).toBe(it.origin?.entryName);
    }
    const first = items[0];
    const reloaded = first ? await loadSource(first) : null;
    expect(reloaded?.size).toBe(png.byteLength);
    expect(new Uint8Array((await reloaded?.arrayBuffer()) ?? new ArrayBuffer(0))).toEqual(png);
  }, 20_000);

  it("設定が変わると、違う設定で作った項目だけ再処理される", async () => {
    const { processor, calls } = fakeProcessor(store);
    setProcessorForTests(processor);
    await addZipFile(ctx, zipFile(2));
    await waitUntil(() => readItems(store).every((it) => it.status === "done"));
    expect(calls).toHaveLength(2);

    // 同じ設定なら何もしない
    syncWithSettings(store, { ...DEFAULT_SETTINGS });
    await new Promise((r) => setTimeout(r, 20));
    expect(calls).toHaveLength(2);

    // 違う設定（別ページの初期値など）なら待たずに再処理
    syncWithSettings(store, { ...DEFAULT_SETTINGS, output: "webp" });
    await waitUntil(
      () => readItems(store).every((it) => it.status === "done") && calls.length === 4,
    );
    expect(readItems(store).every((it) => it.appliedSettings?.output === "webp")).toBe(true);

    // 変更はまとめられ、1 回だけ走る
    scheduleReprocess(store, { ...DEFAULT_SETTINGS, quality: 50 });
    scheduleReprocess(store, { ...DEFAULT_SETTINGS, quality: 60 });
    await waitUntil(
      () => calls.length === 6 && readItems(store).every((it) => it.status === "done"),
    );
    await new Promise((r) => setTimeout(r, 500));
    expect(calls).toHaveLength(6);
    expect(calls.slice(4).every((c) => c.name.endsWith(".png"))).toBe(true);
    expect(readItems(store)[0]?.result?.outputs[0]?.quality).toBe(60);
  }, 20_000);
});

describe("分割 ZIP の計画", () => {
  it("上限を超えそうなら分け、1 本なら .zip、複数なら -partN.zip", () => {
    const blob = (size: number) => new Blob([new Uint8Array(size)]);
    const item = (id: string, sizes: number[]) => ({
      id,
      name: id,
      path: id,
      source: null,
      size: 0,
      type: "image/png",
      status: "done" as const,
      result: {
        inputFormat: "png" as const,
        inputBytes: 0,
        inputWidth: null,
        inputHeight: null,
        warnings: [],
        outputs: sizes.map((s, i) => ({
          name: `${id}-${i}`,
          path: `${id}-${i}`,
          format: "png" as const,
          blob: blob(s),
          width: null,
          height: null,
          quality: null,
          variantWidth: null,
        })),
      },
    });
    const limits = { ...LIMITS.desktop, maxZipBlobBytes: 1000 };
    const one = planZipParts([item("a", [400, 500])], limits, "out");
    expect(one.map((p) => p.name)).toEqual(["out.zip"]);
    const parts = planZipParts([item("a", [400, 500]), item("b", [300, 900])], limits, "out");
    expect(parts.map((p) => p.name)).toEqual(["out-part1.zip", "out-part2.zip", "out-part3.zip"]);
    expect(parts.map((p) => p.bytes)).toEqual([900, 300, 900]);
    expect(parts[1]?.entries).toEqual([{ itemId: "b", outputIndex: 0 }]);
  });
});
