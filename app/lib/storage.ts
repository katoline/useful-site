/**
 * localStorage のラッパー。キーには必ず "image-adjust:" を付ける（同じドメインの他アプリと共有されるため）。
 * プライベートブラウズ等で例外が出ても落ちないよう、すべて try/catch で包む。
 */
import { STORAGE_PREFIX } from "./config";

/** アプリで使うキーの一覧（接頭辞なし）。新しいキーはここに足す */
export const STORAGE_KEYS = {
  theme: "theme",
  lang: "lang",
} as const;
export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS] | (string & {});

export function storageKey(key: StorageKey): string {
  return `${STORAGE_PREFIX}${key}`;
}

function getStore(): Storage | undefined {
  try {
    return typeof window !== "undefined" ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}

export function getItem(key: StorageKey): string | null {
  try {
    return getStore()?.getItem(storageKey(key)) ?? null;
  } catch {
    return null;
  }
}

export function setItem(key: StorageKey, value: string): boolean {
  try {
    const store = getStore();
    if (!store) return false;
    store.setItem(storageKey(key), value);
    return true;
  } catch {
    return false;
  }
}

export function removeItem(key: StorageKey): void {
  try {
    getStore()?.removeItem(storageKey(key));
  } catch {
    // 何もしない
  }
}

export function getJSON<T>(key: StorageKey, fallback: T): T {
  const raw = getItem(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function setJSON(key: StorageKey, value: unknown): boolean {
  try {
    return setItem(key, JSON.stringify(value));
  } catch {
    return false;
  }
}
