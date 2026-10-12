/**
 * テーマ（ライト / ダーク / 端末の設定に従う）の保存と適用。
 * 描画前の適用は THEME_INIT_SCRIPT（root.tsx の <head> 先頭でインライン実行）が担う。
 */
import { useSyncExternalStore } from "react";
import { getItem, STORAGE_KEYS, setItem, storageKey } from "../lib/storage";

export const THEME_PREFERENCES = ["light", "dark", "system"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type ResolvedTheme = "light" | "dark";

/** theme-color meta の値（tokens.css の背景色と揃える） */
export const THEME_COLORS: Record<ResolvedTheme, string> = {
  light: "#ffffff",
  dark: "#0a0a0a",
};

const DARK_QUERY = "(prefers-color-scheme: dark)";

export function isThemePreference(v: unknown): v is ThemePreference {
  return typeof v === "string" && (THEME_PREFERENCES as readonly string[]).includes(v);
}

export function readThemePreference(): ThemePreference {
  const v = getItem(STORAGE_KEYS.theme);
  return isThemePreference(v) ? v : "system";
}

function systemPrefersDark(): boolean {
  try {
    return window.matchMedia(DARK_QUERY).matches;
  } catch {
    return false;
  }
}

export function resolveTheme(pref: ThemePreference): ResolvedTheme {
  if (pref === "system") return systemPrefersDark() ? "dark" : "light";
  return pref;
}

/** <html data-theme> と color-scheme、theme-color meta を書き換える */
export function applyTheme(pref: ThemePreference): ResolvedTheme {
  const resolved = resolveTheme(pref);
  const root = document.documentElement;
  root.setAttribute("data-theme", resolved);
  root.style.colorScheme = resolved;
  // theme-color は media 付きで 2 つある。手動指定時は両方を選んだ色にし、system では元に戻す
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    const media = meta.getAttribute("media") ?? "";
    const forMedia: ResolvedTheme = media.includes("dark") ? "dark" : "light";
    meta.setAttribute("content", THEME_COLORS[pref === "system" ? forMedia : resolved]);
  });
  return resolved;
}

/**
 * <head> 先頭で実行するちらつき防止スクリプト。React より前に動くので依存なしで書く。
 * CSP でハッシュ許可する前提なので、内容を変えたらハッシュも更新すること。
 */
export const THEME_INIT_SCRIPT = `(function(){try{var p=null;try{p=localStorage.getItem(${JSON.stringify(
  storageKey(STORAGE_KEYS.theme),
)})}catch(e){}var d=window.matchMedia&&window.matchMedia(${JSON.stringify(
  DARK_QUERY,
)}).matches;var t=p==="light"||p==="dark"?p:(d?"dark":"light");var r=document.documentElement;r.setAttribute("data-theme",t);r.style.colorScheme=t;if(p==="light"||p==="dark"){var c=t==="dark"?${JSON.stringify(
  THEME_COLORS.dark,
)}:${JSON.stringify(THEME_COLORS.light)};document.addEventListener("DOMContentLoaded",function(){var m=document.querySelectorAll('meta[name="theme-color"]');for(var i=0;i<m.length;i++)m[i].setAttribute("content",c)})}}catch(e){}})();`;

// ---- 外部ストア（useSyncExternalStore 用）。タブ間の同期と OS 設定の追従もここで行う ----

let cachedPreference: ThemePreference | null = null;
const listeners = new Set<() => void>();
let detach: (() => void) | null = null;

function getPreferenceSnapshot(): ThemePreference {
  if (cachedPreference === null) cachedPreference = readThemePreference();
  return cachedPreference;
}

function emit() {
  for (const listener of listeners) listener();
}

function attachGlobalListeners() {
  const onSystemChange = () => {
    if (getPreferenceSnapshot() === "system") {
      applyTheme("system");
      emit();
    }
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key !== storageKey(STORAGE_KEYS.theme)) return;
    cachedPreference = readThemePreference();
    applyTheme(cachedPreference);
    emit();
  };
  let mql: MediaQueryList | undefined;
  try {
    mql = window.matchMedia(DARK_QUERY);
    mql.addEventListener("change", onSystemChange);
  } catch {
    mql = undefined;
  }
  window.addEventListener("storage", onStorage);
  // インラインスクリプトの実行からハイドレーションまでの間に OS 側の設定が変わった分を反映する
  const pref = getPreferenceSnapshot();
  if (document.documentElement.getAttribute("data-theme") !== resolveTheme(pref)) {
    applyTheme(pref);
    queueMicrotask(emit);
  }
  return () => {
    mql?.removeEventListener("change", onSystemChange);
    window.removeEventListener("storage", onStorage);
  };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!detach) detach = attachGlobalListeners();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && detach) {
      detach();
      detach = null;
    }
  };
}

/** テーマを選ぶ（保存して即適用） */
export function setThemePreference(pref: ThemePreference) {
  setItem(STORAGE_KEYS.theme, pref);
  cachedPreference = pref;
  applyTheme(pref);
  emit();
}

/**
 * テーマの状態と切り替え。プリレンダリング時は system / light とみなす
 * （実際の見た目は THEME_INIT_SCRIPT が描画前に data-theme で決めている）。
 */
export function useTheme() {
  const preference = useSyncExternalStore(
    subscribe,
    getPreferenceSnapshot,
    () => "system" as const,
  );
  const resolved = useSyncExternalStore(
    subscribe,
    () => resolveTheme(getPreferenceSnapshot()),
    () => "light" as const,
  );
  return { preference, resolved, setPreference: setThemePreference };
}
