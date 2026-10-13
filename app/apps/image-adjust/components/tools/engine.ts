/**
 * 変換・圧縮ツールの処理の進行（React に依存しない。§2.3・§5）。
 *
 * - 項目・通知・分割 ZIP の計画は ToolSessionStore に置く（言語切り替えで失わない）
 * - Worker プール・世代・進行中の集合・設定変更のタイマーはモジュール変数に置き、
 *   ルートの作り直し（言語切り替え）をまたぐ
 * - 同時に動かすのは Worker 数＋1 件。待機中の項目は Blob のまま、ArrayBuffer は処理中だけ
 * - ZIP の展開は「未処理の項目が一定数を超えたら止まって待つ」（バックプレッシャー）。
 *   ZIP 由来の項目は処理が済んだら元データを解放し、必要なときに ZIP から読み直す
 * - 結果には作ったときの設定を付け、今の設定と違う項目だけ再処理する
 */
import {
  canUseFileSystemAccess,
  downloadBlob,
  pickZipWritable,
} from "~/apps/image-adjust/lib/archive/download";
import {
  readZipEntry,
  readZipImages,
  ZipLimitError,
} from "~/apps/image-adjust/lib/archive/zip-read";
import {
  BlobSink,
  WritableStreamSink,
  ZIP32_MAX_BYTES,
  ZIP32_MAX_ENTRIES,
  ZipWriter,
} from "~/apps/image-adjust/lib/archive/zip-write";
import { formatFromExtension, MIME_TYPE } from "~/apps/image-adjust/lib/codecs/format";
import {
  checkFileSize,
  checkZipSize,
  type Limits,
  workerCount,
} from "~/apps/image-adjust/lib/limits";
import { sanitizeFileName, sanitizePath } from "~/apps/image-adjust/lib/pipeline/naming";
import { CancelledError, createImageProcessor } from "~/apps/image-adjust/lib/pipeline/processor";
import {
  type ImageProcessor,
  ProcessError,
  type ProcessResult,
  type ProcessSettings,
} from "~/apps/image-adjust/lib/pipeline/types";
import type { ToolSessionStore } from "~/platform/state/ToolSessionProvider";
import type { PickedFile } from "./collect-files";
import type {
  ToolErrorCode,
  ToolItem,
  ToolNotice,
  ToolResult,
  ZipOrigin,
  ZipPartPlan,
} from "./types";

export const ITEMS_KEY = "tool:items";
export const NOTICES_KEY = "tool:notices";
export const ZIP_PARTS_KEY = "tool:zipParts";

/** 設定変更をまとめる時間（ms） */
const SETTINGS_DEBOUNCE_MS = 400;

export interface EngineContext {
  store: ToolSessionStore;
  limits: Limits;
  settings: ProcessSettings;
  /** 上限の案内に使う表示用の整形 */
  formatBytes: (bytes: number) => string;
}

const engine = {
  processor: null as ImageProcessor | null,
  generation: 0,
  started: new Set<string>(),
  inFlight: 0,
  context: null as EngineContext | null,
  /** 処理の空きを待っている展開処理 */
  waiters: new Set<() => void>(),
  settingsTimer: null as ReturnType<typeof setTimeout> | null,
};

let idCounter = 0;
function newId(): string {
  idCounter++;
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `item-${Date.now()}-${idCounter}`;
}

/** テスト用：処理の実体を差し替える */
export function setProcessorForTests(processor: ImageProcessor | null): void {
  engine.processor?.dispose();
  engine.processor = processor;
  engine.generation++;
  engine.started.clear();
  engine.inFlight = 0;
}

function getProcessor(limits: Limits): ImageProcessor {
  if (!engine.processor) {
    engine.processor = createImageProcessor({ limits: { maxPixels: limits.maxPixels } });
  }
  return engine.processor;
}

/** 画面側から最新の参照を渡す（描画のたびに呼ぶ） */
export function bindContext(ctx: EngineContext): void {
  engine.context = ctx;
}

export function readItems(store: ToolSessionStore): ToolItem[] {
  return store.get<ToolItem[]>(ITEMS_KEY) ?? [];
}

function updateItems(store: ToolSessionStore, fn: (items: ToolItem[]) => ToolItem[]): void {
  store.set(ITEMS_KEY, fn(readItems(store)));
}

function patchItem(store: ToolSessionStore, id: string, patch: Partial<ToolItem>): void {
  updateItems(store, (items) => items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
}

export function pushNotice(store: ToolSessionStore, code: ToolErrorCode, detail?: string): void {
  const notices = store.get<ToolNotice[]>(NOTICES_KEY) ?? [];
  store.set(NOTICES_KEY, [...notices, { id: newId(), code, detail }]);
}

function toToolResult(r: ProcessResult): ToolResult {
  return {
    inputFormat: r.inputFormat,
    inputBytes: r.inputBytes,
    inputWidth: r.inputWidth,
    inputHeight: r.inputHeight,
    warnings: r.warnings,
    outputs: r.outputs.map((o) => ({
      name: o.name,
      path: o.path,
      format: o.format,
      blob: new Blob([o.bytes], { type: MIME_TYPE[o.format] }),
      width: o.width,
      height: o.height,
      quality: o.quality,
      variantWidth: o.variantWidth,
    })),
  };
}

/** 元データを読む。ZIP 由来で解放済みなら ZIP から読み直す */
export async function loadSource(item: ToolItem): Promise<Blob | null> {
  if (item.source) return item.source;
  if (!item.origin) return null;
  const bytes = await readZipEntry(item.origin.zip, item.origin.entryName);
  return bytes ? new Blob([bytes as BlobPart], { type: item.type }) : null;
}

// ---------------------------------------------------------------- 処理の進行

/** 同時に処理する数 */
function maxInFlight(): number {
  return workerCount() + 1;
}

/** 未処理（待機＋処理中）として同時に抱えてよい数。超えたら ZIP の展開を止めて待つ */
export function maxPendingItems(): number {
  return maxInFlight() * 2;
}

export function pendingCount(store: ToolSessionStore): number {
  return readItems(store).filter((it) => it.status === "queued" || it.status === "processing")
    .length;
}

function notifyWaiters(): void {
  const waiters = [...engine.waiters];
  engine.waiters.clear();
  for (const w of waiters) w();
}

/** 未処理の項目が減るまで待つ（バックプレッシャー） */
export async function waitForCapacity(store: ToolSessionStore): Promise<void> {
  while (pendingCount(store) >= maxPendingItems()) {
    await new Promise<void>((resolve) => engine.waiters.add(resolve));
  }
}

function sameSettings(a: ProcessSettings | undefined, b: ProcessSettings): boolean {
  return !!a && JSON.stringify(a) === JSON.stringify(b);
}

async function runItem(item: ToolItem, ctx: EngineContext): Promise<void> {
  const generation = engine.generation;
  const settings = engine.context?.settings ?? ctx.settings;
  patchItem(ctx.store, item.id, { status: "processing" });
  try {
    const source = await loadSource(item);
    if (!source) throw new ProcessError("decode_failed");
    const bytes = await source.arrayBuffer();
    const result = await getProcessor(ctx.limits).process(
      { id: item.id, name: item.name, path: item.path, bytes, type: item.type },
      settings,
    );
    if (generation !== engine.generation) return; // 古い世代の結果は捨てる
    patchItem(ctx.store, item.id, {
      status: "done",
      result: toToolResult(result),
      error: undefined,
      appliedSettings: settings,
      // ZIP 由来の元データは解放する（必要なら origin から読み直す）
      source: item.origin ? null : item.source,
    });
  } catch (e) {
    if (generation !== engine.generation) return;
    if (e instanceof CancelledError) {
      engine.started.delete(item.id);
      patchItem(ctx.store, item.id, { status: "queued" });
      return;
    }
    const code: ToolErrorCode = e instanceof ProcessError ? e.code : "encode_failed";
    patchItem(ctx.store, item.id, {
      status: "error",
      error: code,
      result: undefined,
      appliedSettings: settings,
      source: item.origin ? null : item.source,
    });
  } finally {
    notifyWaiters();
  }
}

/** 待機中の項目を、同時実行数の範囲で始める */
export function pump(): void {
  const ctx = engine.context;
  if (!ctx) return;
  const max = maxInFlight();
  for (const item of readItems(ctx.store)) {
    if (engine.inFlight >= max) break;
    if (item.status !== "queued" || engine.started.has(item.id)) continue;
    engine.started.add(item.id);
    engine.inFlight++;
    runItem(item, ctx).finally(() => {
      engine.inFlight--;
      pump();
    });
  }
}

/** 今の設定と違う設定で作られた項目を待機に戻して処理し直す */
function reprocessStale(store: ToolSessionStore, settings: ProcessSettings): void {
  const stale = readItems(store).filter(
    (it) =>
      it.status !== "skipped" &&
      (it.status === "queued" ||
        it.status === "processing" ||
        !sameSettings(it.appliedSettings, settings)),
  );
  if (stale.length === 0) return;
  engine.generation++;
  engine.started.clear();
  engine.processor?.cancelPending();
  const ids = new Set(stale.map((it) => it.id));
  updateItems(store, (items) =>
    items.map((it) => (ids.has(it.id) ? { ...it, status: "queued", error: undefined } : it)),
  );
  pump();
}

/**
 * 設定が変わった：少し待ってまとめて再処理する。タイマーはモジュール側に持つので、
 * 待っている間に言語を切り替えてルートが作り直されても取りこぼさない
 */
export function scheduleReprocess(store: ToolSessionStore, settings: ProcessSettings): void {
  if (engine.context) engine.context.settings = settings;
  if (engine.settingsTimer) clearTimeout(engine.settingsTimer);
  engine.settingsTimer = setTimeout(() => {
    engine.settingsTimer = null;
    reprocessStale(store, settings);
  }, SETTINGS_DEBOUNCE_MS);
}

/** マウント時：別ページの設定で作った結果があれば、待たずに再処理する */
export function syncWithSettings(store: ToolSessionStore, settings: ProcessSettings): void {
  if (engine.context) engine.context.settings = settings;
  if (engine.settingsTimer) return; // 変更待ちがあればそちらに任せる
  reprocessStale(store, settings);
}

// ---------------------------------------------------------------- 入力

interface NewItem {
  source: Blob;
  name: string;
  path: string;
  type: string;
  origin?: ZipOrigin;
}

export function addItem(ctx: EngineContext, input: NewItem): ToolItem {
  const violation = checkFileSize(input.source.size, ctx.limits);
  const item: ToolItem = {
    id: newId(),
    name: sanitizeFileName(input.name),
    path: sanitizePath(input.path) || sanitizeFileName(input.name),
    source: input.source,
    origin: input.origin,
    size: input.source.size,
    type: input.type,
    status: violation ? "skipped" : "queued",
    error: violation ?? undefined,
  };
  updateItems(ctx.store, (prev) => [...prev, item]);
  pump();
  return item;
}

function isZipFile(file: File): boolean {
  return /\.zip$/i.test(file.name) || /zip/i.test(file.type);
}

/** ZIP を 1 件ずつ展開して項目にする。未処理が溜まったら待つ */
export async function addZipFile(ctx: EngineContext, file: File): Promise<void> {
  const { store, limits } = ctx;
  if (checkZipSize(file.size, limits)) {
    pushNotice(store, "zip_too_large", ctx.formatBytes(limits.maxZipBytes));
    return;
  }
  try {
    await readZipImages(file, {
      limits,
      onEntry: async (entry) => {
        await waitForCapacity(store);
        addItem(ctx, {
          source: new Blob([entry.bytes], { type: MIME_TYPE[entry.format] }),
          name: entry.name,
          path: entry.path,
          type: MIME_TYPE[entry.format],
          origin: { zip: file, entryName: entry.entryName },
        });
      },
      onSkip: (p, reason) => {
        if (reason === "file_too_large") {
          pushNotice(store, "file_too_large", `${p} (${ctx.formatBytes(limits.maxFileBytes)})`);
        }
      },
    });
  } catch (e) {
    if (e instanceof ZipLimitError) pushNotice(store, e.code);
    else pushNotice(store, "zip_read_failed", file.name);
  }
}

export async function addPickedFiles(ctx: EngineContext, picked: PickedFile[]): Promise<void> {
  for (const { file, path } of picked) {
    if (isZipFile(file)) {
      await addZipFile(ctx, file);
      continue;
    }
    // 画像以外（拡張子でも MIME でも判定できない）は無視する
    if (!formatFromExtension(file.name) && !file.type.startsWith("image/")) continue;
    addItem(ctx, { source: file, name: file.name, path, type: file.type });
  }
}

export function removeItem(store: ToolSessionStore, id: string): void {
  engine.started.delete(id);
  updateItems(store, (items) => items.filter((it) => it.id !== id));
  store.set(ZIP_PARTS_KEY, []);
  notifyWaiters();
}

export function clearAll(store: ToolSessionStore): void {
  engine.generation++;
  engine.started.clear();
  engine.processor?.cancelPending();
  store.set(ITEMS_KEY, []);
  store.set(NOTICES_KEY, []);
  store.set(ZIP_PARTS_KEY, []);
  notifyWaiters();
}

// ---------------------------------------------------------------- 一括保存（ZIP）

/**
 * 出力を ZIP に分ける計画。1 本の上限は、Blob でまとめるなら端末の上限、
 * File System Access ならディスク直書きなので fflate が書ける 4GiB 未満まで（§5）
 */
export function planZipParts(items: ToolItem[], limits: Limits, baseName: string): ZipPartPlan[] {
  const maxBytes = canUseFileSystemAccess()
    ? ZIP32_MAX_BYTES
    : Math.min(limits.maxZipBlobBytes, ZIP32_MAX_BYTES);
  const parts: ZipPartPlan[] = [];
  let current: ZipPartPlan | null = null;
  for (const it of items) {
    if (it.status !== "done" || !it.result) continue;
    it.result.outputs.forEach((o, outputIndex) => {
      if (
        current &&
        (current.bytes + o.blob.size > maxBytes || current.entries.length >= ZIP32_MAX_ENTRIES)
      ) {
        current = null;
      }
      if (!current) {
        current = { index: parts.length, name: "", entries: [], bytes: 0, saved: false };
        parts.push(current);
      }
      current.entries.push({ itemId: it.id, outputIndex });
      current.bytes += o.blob.size;
    });
  }
  for (const p of parts) {
    p.name = parts.length === 1 ? `${baseName}.zip` : `${baseName}-part${p.index + 1}.zip`;
  }
  return parts;
}

/** 1 本の ZIP を書いて保存する。キャンセルなら false */
export async function saveZipPart(store: ToolSessionStore, part: ZipPartPlan): Promise<boolean> {
  const items = new Map(readItems(store).map((it) => [it.id, it]));
  const outputs = part.entries
    .map((e) => items.get(e.itemId)?.result?.outputs[e.outputIndex])
    .filter((o): o is NonNullable<typeof o> => !!o);
  if (outputs.length === 0) return false;

  const write = async (writer: ZipWriter) => {
    for (const o of outputs) {
      await writer.add({
        path: o.path,
        bytes: await o.blob.arrayBuffer(),
        compress: o.format === "svg",
      });
    }
    await writer.finish();
  };

  if (canUseFileSystemAccess()) {
    const writable = await pickZipWritable(part.name);
    if (!writable) return false;
    const sink = new WritableStreamSink(writable);
    try {
      await write(new ZipWriter(sink));
    } catch (e) {
      // 書きかけのファイルを残さない
      await sink.abort();
      pushNotice(store, "zip_write_failed", part.name);
      throw e;
    }
  } else {
    const sink = new BlobSink();
    try {
      await write(new ZipWriter(sink));
    } catch (e) {
      pushNotice(store, "zip_write_failed", part.name);
      throw e;
    }
    downloadBlob(sink.result(), part.name);
  }
  const parts = store.get<ZipPartPlan[]>(ZIP_PARTS_KEY) ?? [];
  store.set(
    ZIP_PARTS_KEY,
    parts.map((p) => (p.index === part.index ? { ...p, saved: true } : p)),
  );
  return true;
}
