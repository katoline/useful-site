/** 保存された履歴の検証（壊れた値・古い形の値は捨てる） */
import { HISTORY_LIMIT } from "../../../domain/limits";
import type { SpeedTestResult } from "../../../domain/measurement";

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;
const isTextOrNull = (value: unknown): value is string | null =>
  value === null || typeof value === "string";

function isResult(value: unknown): value is SpeedTestResult {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  const latency = r.latency as Record<string, unknown> | undefined;
  const server = r.server as Record<string, unknown> | undefined;
  return (
    typeof r.measuredAt === "string" &&
    !Number.isNaN(Date.parse(r.measuredAt)) &&
    isNumber(r.downloadMbps) &&
    isNumber(r.uploadMbps) &&
    !!latency &&
    isNumber(latency.pingMs) &&
    isNumber(latency.jitterMs) &&
    isNumber(latency.minMs) &&
    isNumber(latency.samples) &&
    !!server &&
    isTextOrNull(server.colo) &&
    isTextOrNull(server.country) &&
    isTextOrNull(server.isp)
  );
}

export function validateHistory(value: unknown): SpeedTestResult[] {
  return Array.isArray(value) ? value.filter(isResult).slice(0, HISTORY_LIMIT) : [];
}
