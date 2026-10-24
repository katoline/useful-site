/** 測定結果の履歴を localStorage に置く（この端末だけ。送信しない） */
import { createStorage } from "~/platform/storage";
import { HISTORY_LIMIT } from "../../../domain/limits";
import type { SpeedTestResult } from "../../../domain/measurement";
import { validateHistory } from "../core/history";

const store = createStorage("speed-test:");
const KEY = "history";

export const historyStorage = {
  load(): SpeedTestResult[] {
    return validateHistory(store.getJSON<unknown>(KEY, []));
  },
  /** 新しい順に HISTORY_LIMIT 件まで残す */
  add(result: SpeedTestResult): SpeedTestResult[] {
    const history = [result, ...this.load()].slice(0, HISTORY_LIMIT);
    store.setJSON(KEY, history);
    return history;
  },
  clear(): void {
    store.removeItem(KEY);
  },
};
