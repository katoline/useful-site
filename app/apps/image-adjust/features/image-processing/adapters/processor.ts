/**
 * ImageProcessor の実装（メインスレッド側）。
 * - 既定は Web Worker のプール（画像単位で並列。Worker 数は limits.ts の currentWorkerCount()）
 * - GIF は gifsicle-wasm-browser が自前の Worker を持つので、メインスレッドから呼ぶ
 * - Worker が使えない環境（プリレンダリング・テスト）では同じスレッドで処理する
 * - Worker が落ちた（error / messageerror）ときは進行中のタスクを失敗にして slot を作り直す
 */
import { type Remote, transfer, wrap } from "comlink";
import { detectFormatWithHints } from "../../../domain/format";
import { currentLimits, currentWorkerCount } from "../../../shared/device";
import {
  type ImageProcessor,
  ProcessError,
  type ProcessInput,
  type ProcessResult,
  type ProcessSettings,
} from "../core/types";
import type { ImageWorkerApi, SerializedProcessError } from "./image.worker";
import { type ProcessLimits, processImage } from "./process";

export class CancelledError extends Error {
  constructor() {
    super("cancelled");
    this.name = "CancelledError";
  }
}

function isSerializedProcessError(e: unknown): e is SerializedProcessError {
  return typeof e === "object" && e !== null && "processErrorCode" in e;
}

function toProcessError(e: unknown): unknown {
  if (isSerializedProcessError(e)) return new ProcessError(e.processErrorCode, e.message);
  return e;
}

interface Task {
  input: ProcessInput;
  settings: ProcessSettings;
  resolve: (r: ProcessResult) => void;
  reject: (e: unknown) => void;
}

interface Slot {
  worker: Worker;
  remote: Remote<ImageWorkerApi>;
  /** 進行中のタスク。Worker が落ちたときに失敗させる */
  current: Task | null;
  /** 落ちた Worker を二重に扱わないための印 */
  dead: boolean;
}

export interface ProcessorOptions {
  /** Worker の数。省略時は端末から決める */
  workers?: number;
  limits?: ProcessLimits;
}

class WorkerPoolProcessor implements ImageProcessor {
  private slots: Slot[] = [];
  private queue: Task[] = [];
  private readonly size: number;
  private readonly limits: ProcessLimits;
  private disposed = false;

  constructor(options: ProcessorOptions) {
    this.size = Math.max(1, options.workers ?? currentWorkerCount());
    this.limits = options.limits ?? { maxPixels: currentLimits().maxPixels };
  }

  process(input: ProcessInput, settings: ProcessSettings): Promise<ProcessResult> {
    // GIF はメインスレッドで（gifsicle が自前の Worker を立てる）
    if (detectFormatWithHints(input.bytes, { name: input.name, type: input.type }) === "gif") {
      return processImage(input, settings, this.limits);
    }
    return new Promise<ProcessResult>((resolve, reject) => {
      this.queue.push({ input, settings, resolve, reject });
      this.pump();
    });
  }

  cancelPending(): void {
    const pending = this.queue.splice(0);
    for (const task of pending) task.reject(new CancelledError());
  }

  dispose(): void {
    this.disposed = true;
    this.cancelPending();
    for (const slot of this.slots) slot.worker.terminate();
    this.slots = [];
  }

  private createSlot(): Slot {
    const worker = new Worker(new URL("./image.worker.ts", import.meta.url), {
      type: "module",
    });
    const slot: Slot = { worker, remote: wrap<ImageWorkerApi>(worker), current: null, dead: false };
    const onCrash = (reason: string) => () => {
      this.discardSlot(slot, new ProcessError("encode_failed", `worker ${reason}`));
    };
    // メモリ不足・読み込み失敗などで Worker 自体が落ちたとき（comlink の Promise は決着しない）
    worker.addEventListener("error", onCrash("error"));
    worker.addEventListener("messageerror", onCrash("messageerror"));
    return slot;
  }

  /** 落ちた Worker を捨て、進行中のタスクを失敗にして次へ進む */
  private discardSlot(slot: Slot, error: unknown): void {
    if (slot.dead) return;
    slot.dead = true;
    slot.worker.terminate();
    this.slots = this.slots.filter((s) => s !== slot);
    const task = slot.current;
    slot.current = null;
    task?.reject(error);
    this.pump();
  }

  private pump(): void {
    if (this.disposed) return;
    while (this.queue.length > 0) {
      let slot = this.slots.find((s) => !s.current);
      if (!slot) {
        if (this.slots.length >= this.size) return;
        slot = this.createSlot();
        this.slots.push(slot);
      }
      const task = this.queue.shift();
      if (!task) return;
      this.run(slot, task);
    }
  }

  private async run(slot: Slot, task: Task): Promise<void> {
    slot.current = task;
    try {
      const result = await slot.remote.process(
        transfer(task.input, [task.input.bytes]),
        task.settings,
        this.limits,
      );
      if (slot.current === task) task.resolve(result);
    } catch (e) {
      if (slot.dead) return; // 既に discardSlot が失敗にしている
      if (!isSerializedProcessError(e)) {
        // 想定外の失敗（構造化クローン不可など）：Worker を作り直す
        this.discardSlot(slot, toProcessError(e));
        return;
      }
      task.reject(toProcessError(e));
    } finally {
      if (slot.current === task) slot.current = null;
      this.pump();
    }
  }
}

/** 同じスレッドで処理する実装（Worker が無い環境・テスト用） */
class InlineProcessor implements ImageProcessor {
  private readonly limits: ProcessLimits;
  private cancelled = false;
  constructor(options: ProcessorOptions) {
    this.limits = options.limits ?? { maxPixels: currentLimits().maxPixels };
  }
  async process(input: ProcessInput, settings: ProcessSettings): Promise<ProcessResult> {
    if (this.cancelled) throw new CancelledError();
    return processImage(input, settings, this.limits);
  }
  cancelPending(): void {
    // 同期的に 1 件ずつ処理するので取り消すものは無い
  }
  dispose(): void {
    this.cancelled = true;
  }
}

export function createImageProcessor(options: ProcessorOptions = {}): ImageProcessor {
  if (typeof Worker === "undefined") return new InlineProcessor(options);
  return new WorkerPoolProcessor(options);
}
