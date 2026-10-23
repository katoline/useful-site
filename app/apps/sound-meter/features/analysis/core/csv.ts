/** 計測の時系列を CSV にする（表計算ソフトで開ける。見出しは言語に依らず英語） */
import type { FrameAnalysis } from "../../../domain/measurement";

const round = (value: number, digits: number) => Number(value.toFixed(digits));

export function framesToCsv(frames: readonly FrameAnalysis[], calibrationDb: number): string {
  const header = "time_s,level_dbfs,level_a_dbfs,estimated_db_a,peak_dbfs,dominant_hz,centroid_hz";
  const rows = frames.map((frame) =>
    [
      round(frame.timeMs / 1000, 2),
      round(frame.levelDbfs, 1),
      round(frame.levelADbfs, 1),
      round(frame.levelADbfs + calibrationDb, 1),
      round(frame.peakDbfs, 1),
      frame.dominantHz === null ? "" : round(frame.dominantHz, 1),
      frame.centroidHz === null ? "" : round(frame.centroidHz, 0),
    ].join(","),
  );
  return `${[header, ...rows].join("\r\n")}\r\n`;
}
