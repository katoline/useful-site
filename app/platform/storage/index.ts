/**
 * localStorage（または sessionStorage）のラッパー。キーには呼び出し側が指定した接頭辞を付ける
 * （同じドメインの他アプリと共有されるため）。
 * プライベートブラウズ等で例外が出ても落ちないよう、すべて try/catch で包む。
 */
import { STORAGE_PREFIX } from "../config/index.ts";

/** アプリで使うキーの一覧（接頭辞なし）。新しいキーはここに足す */
export const STORAGE_KEYS = {
  theme: "theme",
  lang: "lang",
} as const;
export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS] | (string & {});

/** 保存先。local：端末に残す（既定）、session：タブを閉じるまで（再読み込みでは残る） */
export type StorageArea = "local" | "session";

export function createStorage(prefix: string, area: StorageArea = "local") {
  function storageKey(key: StorageKey): string {
    return prefix + key;
  }

  function getStore(): Storage | undefined {
    try {
      if (typeof window === "undefined") return undefined;
      return area === "session" ? window.sessionStorage : window.localStorage;
    } catch {
      return undefined;
    }
  }

  function getItem(key: StorageKey): string | null {
    try {
      return getStore()?.getItem(storageKey(key)) ?? null;
    } catch {
      return null;
    }
  }

  function setItem(key: StorageKey, value: string): boolean {
    try {
      const store = getStore();
      if (!store) return false;
      store.setItem(storageKey(key), value);
      return true;
    } catch {
      return false;
    }
  }

  function removeItem(key: StorageKey): void {
    try {
      getStore()?.removeItem(storageKey(key));
    } catch {
      // 何もしない
    }
  }

  function getJSON<T>(key: StorageKey, fallback: T): T {
    const raw = getItem(key);
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  function setJSON(key: StorageKey, value: unknown): boolean {
    try {
      return setItem(key, JSON.stringify(value));
    } catch {
      return false;
    }
  }

  return { storageKey, getItem, setItem, removeItem, getJSON, setJSON };
}
export const { storageKey, getItem, setItem, removeItem, getJSON, setJSON } =
  createStorage(STORAGE_PREFIX);
