/** 測定の手順：情報 → Ping → ダウンロード → アップロード。通信は transport に任せる */
import { PING_COUNT, TRANSFER_DURATION_MS, WARMUP_MS } from "../../../domain/limits";
import type {
  LatencyResult,
  Phase,
  ServerInfo,
  SpeedTestResult,
} from "../../../domain/measurement";
import type { SpeedTestTransport } from "./port";
import { recentMbps, steadyMbps, summarizeLatency, type TransferSample } from "./stats";

export interface SpeedTestProgress {
  phase: Phase;
  /** その段階の進み具合（0〜1） */
  progress: number;
  /** 測定中の速度（ダウンロード・アップロード中だけ） */
  liveMbps: number | null;
  /** ここまでに出た結果 */
  server?: ServerInfo;
  latency?: LatencyResult;
  downloadMbps?: number;
  uploadMbps?: number;
}

export interface RunOptions {
  /** 単調に増える時刻（ミリ秒） */
  now(): number;
  onProgress(progress: SpeedTestProgress): void;
  signal: AbortSignal;
  durationMs?: number;
  pingCount?: number;
}

/** 測定中の表示を更新する間隔（ミリ秒） */
const PROGRESS_INTERVAL_MS = 100;
/** 測定中の速度を出す区間（ミリ秒） */
const LIVE_WINDOW_MS = 1000;

async function measureTransfer(
  run: (onBytes: (bytes: number) => void) => Promise<void>,
  durationMs: number,
  options: RunOptions,
  report: (progress: number, liveMbps: number) => void,
): Promise<number> {
  const start = options.now();
  const samples: TransferSample[] = [];
  let total = 0;
  let lastReport = -Infinity;
  await run((bytes) => {
    total += bytes;
    const t = options.now() - start;
    samples.push({ t, bytes: total });
    if (t - lastReport >= PROGRESS_INTERVAL_MS) {
      lastReport = t;
      report(Math.min(1, t / durationMs), recentMbps(samples, LIVE_WINDOW_MS));
    }
  });
  // 最後に届いてから終わるまでの時間も測定時間に含める（途中で止まった回線を速く見せない）
  samples.push({ t: options.now() - start, bytes: total });
  return steadyMbps(samples, WARMUP_MS);
}

export async function runSpeedTest(
  transport: SpeedTestTransport,
  options: RunOptions,
): Promise<SpeedTestResult> {
  const { signal, onProgress } = options;
  const durationMs = options.durationMs ?? TRANSFER_DURATION_MS;
  const pingCount = options.pingCount ?? PING_COUNT;

  onProgress({ phase: "info", progress: 0, liveMbps: null });
  const server = await transport.info(signal);

  // 最初の 1 回は接続の確立（TLS 等）を含むので捨てる
  await transport.ping(signal);
  const pings: number[] = [];
  for (let i = 0; i < pingCount; i++) {
    pings.push(await transport.ping(signal));
    onProgress({ phase: "ping", progress: (i + 1) / pingCount, liveMbps: null, server });
  }
  const latency = summarizeLatency(pings);

  const downloadMbps = await measureTransfer(
    (onBytes) => transport.download(durationMs, onBytes, signal),
    durationMs,
    options,
    (progress, liveMbps) => onProgress({ phase: "download", progress, liveMbps, server, latency }),
  );

  const uploadMbps = await measureTransfer(
    (onBytes) => transport.upload(durationMs, onBytes, signal),
    durationMs,
    options,
    (progress, liveMbps) =>
      onProgress({ phase: "upload", progress, liveMbps, server, latency, downloadMbps }),
  );

  return {
    measuredAt: new Date().toISOString(),
    downloadMbps,
    uploadMbps,
    latency,
    server,
  };
}
