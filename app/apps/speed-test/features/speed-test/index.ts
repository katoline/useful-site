/** speed-test：回線速度の測定・結果の表示・履歴（feature の外からはここだけを import する） */
export { historyStorage } from "./adapters/history-storage";
export { createHttpTransport } from "./adapters/http-transport";
export type { SpeedTestTransport } from "./core/port";
export { formatDateTime } from "./ui/format";
export { HistoryList } from "./ui/HistoryList";
export { ResultCards } from "./ui/ResultCards";
export { SpeedMeter } from "./ui/SpeedMeter";
export { UsageList } from "./ui/UsageList";
export { useSpeedTest } from "./ui/use-speed-test";
