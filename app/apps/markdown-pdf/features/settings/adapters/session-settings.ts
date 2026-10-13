/** 設定を sessionStorage に置く（再読み込みで残し、タブを閉じれば消える） */
import { createStorage } from "~/platform/storage";
import type { DocumentSettings } from "../../../domain/document-settings";
import { validateSettings } from "../core/settings";

const store = createStorage("markdown-pdf:", "session");
const KEY = "settings";

export const settingsStorage = {
  /** 保存が無ければ null。壊れた値は検証して直す */
  load(): DocumentSettings | null {
    const saved = store.getJSON<unknown>(KEY, null);
    return saved === null ? null : validateSettings(saved);
  },
  save(settings: DocumentSettings): void {
    store.setJSON(KEY, settings);
  },
};
