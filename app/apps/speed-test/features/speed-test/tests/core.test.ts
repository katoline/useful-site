/** feature 内の純粋関数を DOM なしで検証する。 */
import { describe, expect, it } from "vitest";
import { canHandle, speedLevel, USAGES } from "../../../domain/measurement";
import { validateHistory } from "../core/history";
import type { SpeedTestTransport } from "../core/port";
import { runSpeedTest, type SpeedTestProgress } from "../core/runner";
import {
  bytesAt,
  jitter,
  median,
  recentMbps,
  steadyMbps,
  summarizeLatency,
  toMbps,
} from "../core/stats";

describe("集計", () => {
  it("中央値とジッター", () => {
    expect(median([30, 10, 20])).toBe(20);
    expect(median([10, 20, 30, 40])).toBe(25);
    expect(median([])).toBe(0);
    expect(jitter([10, 20, 10, 30])).toBeCloseTo((10 + 10 + 20) / 3);
    expect(jitter([5])).toBe(0);
    expect(summarizeLatency([12, 10, 14])).toEqual({
      pingMs: 12,
      jitterMs: 3,
      minMs: 10,
      samples: 3,
    });
  });

  it("速度（Mbps）", () => {
    // 1 秒で 125,000 バイト = 1 Mbps
    expect(toMbps(125_000, 1000)).toBeCloseTo(1);
    expect(toMbps(1, 0)).toBe(0);
  });

  it("立ち上がりを除いた平均と、直近の速度", () => {
    // 始めの 1 秒は遅く（1 Mbps）、その後は 10 Mbps
    const samples = [
      { t: 1000, bytes: 125_000 },
      { t: 2000, bytes: 125_000 + 1_250_000 },
      { t: 3000, bytes: 125_000 + 2_500_000 },
    ];
    expect(bytesAt(samples, 500)).toBeCloseTo(62_500);
    expect(steadyMbps(samples, 1000)).toBeCloseTo(10);
    expect(recentMbps(samples, 1000)).toBeCloseTo(10);
    expect(steadyMbps([], 1000)).toBe(0);
    // 短すぎる測定は全体の平均
    expect(steadyMbps([{ t: 1000, bytes: 125_000 }], 1000)).toBeCloseTo(1);
  });
});

describe("測定の手順", () => {
  function fakeTransport(): SpeedTestTransport & { clock: { t: number } } {
    const clock = { t: 0 };
    const transfer =
      (bytesPerMs: number) => async (durationMs: number, onBytes: (b: number) => void) => {
        for (let elapsed = 0; elapsed < durationMs; elapsed += 100) {
          clock.t += 100;
          onBytes(bytesPerMs * 100);
        }
      };
    return {
      clock,
      info: async () => ({ colo: "NRT", country: "JP", isp: "Example" }),
      ping: async () => 20,
      // 下り 100 Mbps（12,500 バイト/ms）、上り 10 Mbps
      download: transfer(12_500),
      upload: transfer(1_250),
    };
  }

  it("段階を順に進め、結果をまとめる", async () => {
    const transport = fakeTransport();
    const phases: SpeedTestProgress["phase"][] = [];
    const result = await runSpeedTest(transport, {
      now: () => transport.clock.t,
      onProgress: (p) => {
        if (phases.at(-1) !== p.phase) phases.push(p.phase);
      },
      signal: new AbortController().signal,
      durationMs: 4000,
      pingCount: 5,
    });
    expect(phases).toEqual(["info", "ping", "download", "upload"]);
    expect(result.downloadMbps).toBeCloseTo(100);
    expect(result.uploadMbps).toBeCloseTo(10);
    expect(result.latency.pingMs).toBe(20);
    expect(result.server.colo).toBe("NRT");
  });
});

describe("目安・履歴", () => {
  const result = {
    downloadMbps: 30,
    uploadMbps: 5,
    latency: { pingMs: 80, jitterMs: 2, minMs: 70, samples: 20 },
  };

  it("用途ごとに足りているか", () => {
    const ok = Object.fromEntries(USAGES.map((u) => [u.id, canHandle(u, result)]));
    expect(ok).toMatchObject({
      web: true,
      video4k: true,
      videoCall: true,
      gaming: false,
      bigFiles: false,
    });
  });

  it("速さの段階", () => {
    expect(speedLevel(1)).toBe("verySlow");
    expect(speedLevel(50)).toBe("fast");
    expect(speedLevel(500)).toBe("veryFast");
  });

  it("壊れた履歴は捨てる", () => {
    const good = {
      ...result,
      measuredAt: "2026-10-24T00:00:00.000Z",
      server: { colo: "NRT", country: null, isp: null },
    };
    expect(validateHistory([good, { ...good, downloadMbps: "x" }, null])).toEqual([good]);
    expect(validateHistory("x")).toEqual([]);
  });
});
