/**
 * 画像処理の Web Worker（§3.4）。comlink で processImage を公開する。
 * コーデック（WASM）は processImage の中で最初に使うときに動的 import される。
 */
import { expose, transfer } from "comlink";
import { type ProcessLimits, processImage } from "../lib/pipeline/process";
import {
  ProcessError,
  type ProcessInput,
  type ProcessResult,
  type ProcessSettings,
} from "../lib/pipeline/types";

/** comlink は Error の独自プロパティを運ばないので、code を平文のオブジェクトで返す */
export interface SerializedProcessError {
  processErrorCode: ProcessError["code"];
  message: string;
}

const api = {
  async process(
    input: ProcessInput,
    settings: ProcessSettings,
    limits?: ProcessLimits,
  ): Promise<ProcessResult> {
    try {
      const result = await processImage(input, settings, limits);
      return transfer(
        result,
        result.outputs.map((o) => o.bytes),
      );
    } catch (e) {
      if (e instanceof ProcessError) {
        const serialized: SerializedProcessError = { processErrorCode: e.code, message: e.message };
        throw serialized;
      }
      throw e;
    }
  },
};

export type ImageWorkerApi = typeof api;

expose(api);
