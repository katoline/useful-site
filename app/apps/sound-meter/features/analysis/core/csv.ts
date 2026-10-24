/** 計測の時系列を CSV にする（表計算ソフトで開ける。見出しは言語に依らず英語） */
import type { FrameAnalysis, Weighting } from "../../../domain/measurement";

const round = (value: number, digits: number) => Number(value.toFixed(digits));

/** 見出しに重み付けを入れる（例：estimated_db_a_fast） */
export function framesToCsv(
  frames: readonly FrameAnalysis[],
  calibrationDb: number,
  weighting: Weighting,
): string {
  const w = `${weighting.frequency.toLowerCase()}_${weighting.time}`;
  const header = [
    "time_s",
    "raw_dbfs",
    `level_${w}_dbfs`,
    `estimated_db_${w}`,
    `leq_${weighting.frequency.toLowerCase()}_dbfs`,
    "peak_dbfs",
    "dominant_hz",
    "centroid_hz",
  ].join(",");
  const rows = frames.map((frame) =>
    [
      round(frame.timeMs / 1000, 2),
      round(frame.rawDbfs, 1),
      round(frame.levelDbfs, 1),
      round(frame.levelDbfs + calibrationDb, 1),
      round(frame.leqDbfs, 1),
      round(frame.peakDbfs, 1),
      frame.dominantHz === null ? "" : round(frame.dominantHz, 1),
      frame.centroidHz === null ? "" : round(frame.centroidHz, 0),
    ].join(","),
  );
  return `${[header, ...rows].join("\r\n")}\r\n`;
}
