/** 測定の通信の窓口（実装は adapters。fetch・XHR はそちらに閉じ込める） */
import type { ServerInfo } from "../../../domain/measurement";

export interface SpeedTestTransport {
  info(signal: AbortSignal): Promise<ServerInfo>;
  /** 1 回の往復にかかった時間（ミリ秒） */
  ping(signal: AbortSignal): Promise<number>;
  /** durationMs の間ダウンロードし続け、受け取るたびに onBytes に増えた分を渡す */
  download(
    durationMs: number,
    onBytes: (bytes: number) => void,
    signal: AbortSignal,
  ): Promise<void>;
  /** durationMs の間アップロードし続け、送るたびに onBytes に増えた分を渡す */
  upload(durationMs: number, onBytes: (bytes: number) => void, signal: AbortSignal): Promise<void>;
}

export type SpeedTestErrorKind = "network" | "rate-limited" | "server";

export class SpeedTestError extends Error {
  constructor(
    readonly kind: SpeedTestErrorKind,
    options?: { cause?: unknown },
  ) {
    super(`speed test: ${kind}`, options);
    this.name = "SpeedTestError";
  }
}
