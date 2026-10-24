/** 測定の用語と型。速度は Mbps（1 秒あたりのメガビット）、時間はミリ秒で持つ */

export type Phase = "info" | "ping" | "download" | "upload";

/** 測定に使ったサーバー（Cloudflare のデータセンター）と回線の情報 */
export interface ServerInfo {
  /** データセンターの 3 文字のコード（例：NRT） */
  colo: string | null;
  /** 利用者の国（ISO 3166-1 alpha-2） */
  country: string | null;
  /** 利用者のプロバイダー（AS の組織名） */
  isp: string | null;
}

export interface LatencyResult {
  /** 中央値（ミリ秒） */
  pingMs: number;
  /** ぶれ（続けて測った値の差の平均。ミリ秒） */
  jitterMs: number;
  minMs: number;
  samples: number;
}

export interface SpeedTestResult {
  /** 測定した時刻（ISO 8601） */
  measuredAt: string;
  downloadMbps: number;
  uploadMbps: number;
  latency: LatencyResult;
  server: ServerInfo;
}

/** この速度でできることの目安（必要な速度は一般的な目安の値） */
export const USAGES = [
  { id: "web", downMbps: 1, upMbps: 0, pingMs: null },
  { id: "music", downMbps: 1, upMbps: 0, pingMs: null },
  { id: "videoHd", downMbps: 5, upMbps: 0, pingMs: null },
  { id: "video4k", downMbps: 25, upMbps: 0, pingMs: null },
  { id: "videoCall", downMbps: 3, upMbps: 3, pingMs: 150 },
  { id: "gaming", downMbps: 10, upMbps: 3, pingMs: 50 },
  { id: "bigFiles", downMbps: 100, upMbps: 0, pingMs: null },
] as const;
export type UsageId = (typeof USAGES)[number]["id"];

/** 回線の速さの段階（下りの Mbps。上限は「未満」） */
export const SPEED_LEVELS = [
  { id: "verySlow", below: 3 },
  { id: "slow", below: 10 },
  { id: "fair", below: 30 },
  { id: "fast", below: 100 },
  { id: "veryFast", below: Number.POSITIVE_INFINITY },
] as const;
export type SpeedLevel = (typeof SPEED_LEVELS)[number]["id"];

export function speedLevel(downloadMbps: number): SpeedLevel {
  return (SPEED_LEVELS.find((level) => downloadMbps < level.below) ?? SPEED_LEVELS[4]).id;
}

/** その用途に足りているか */
export function canHandle(
  usage: (typeof USAGES)[number],
  result: Pick<SpeedTestResult, "downloadMbps" | "uploadMbps" | "latency">,
): boolean {
  return (
    result.downloadMbps >= usage.downMbps &&
    result.uploadMbps >= usage.upMbps &&
    (usage.pingMs === null || result.latency.pingMs <= usage.pingMs)
  );
}
