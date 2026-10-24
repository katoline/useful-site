/** 設定（計測時間・補正値）を localStorage に置く（端末のマイクに合わせた補正値を次回も使う） */
import { createStorage } from "~/platform/storage";
import { type MeterSettings, SETTINGS_VERSION, validateMeterSettings } from "../core/settings";

const store = createStorage("sound-meter:");
const KEY = "settings";

export const settingsStorage = {
  /** 保存が無ければ null。壊れた値は検証して直す */
  load(): MeterSettings | null {
    const saved = store.getJSON<unknown>(KEY, null);
    return saved === null ? null : validateMeterSettings(saved);
  },
  save(settings: MeterSettings): void {
    store.setJSON(KEY, { ...settings, version: SETTINGS_VERSION });
  },
};
