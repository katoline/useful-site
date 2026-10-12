/**
 * Service Worker の登録・更新とインストール導線の状態（React の外のストア）。
 * beforeinstallprompt はハイドレーション前に来ることがあるので、モジュールの読み込み時から待ち受ける。
 */
import { useSyncExternalStore } from "react";
import type { Workbox } from "workbox-window";
import { SW_SCOPE, SW_URL } from "~/lib/pwa";

/** Chromium の beforeinstallprompt（標準の型が無い） */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface PwaState {
  /** 新しい Service Worker が待機中（「更新があります」を出す） */
  updateWaiting: boolean;
  /**
   * 他のタブの操作で新しい版に切り替わった（このページはまだ古い版）。
   * 作業中の画像を失わせないため自動では再読み込みせず、「再読み込みしてください」と案内する
   */
  updatedElsewhere: boolean;
  /** Android 等でインストールできる（beforeinstallprompt を受け取った） */
  canInstall: boolean;
}

let state: PwaState = { updateWaiting: false, updatedElsewhere: false, canInstall: false };
const SERVER_STATE: PwaState = { updateWaiting: false, updatedElsewhere: false, canInstall: false };
const listeners = new Set<() => void>();
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let workbox: Workbox | null = null;
let registration: ServiceWorkerRegistration | null = null;
let registering = false;
/** このタブで「再読み込み」を押した（切り替わったら再読み込みする） */
let reloadRequested = false;

function setState(patch: Partial<PwaState>) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    // ブラウザ既定のミニ情報バーを出さず、こちらのボタンから出す
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    setState({ canInstall: true });
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    setState({ canInstall: false });
  });
}

/** 1 時間ごとに更新を確認する */
const UPDATE_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Service Worker を登録する（本番ビルドのみ。dev には sw.js が無い）。
 * workbox-window は CommonJS で、プリレンダリング（Node）では読み込めないので動的 import にする
 */
export function registerServiceWorker(): void {
  if (registering || import.meta.env.DEV || !("serviceWorker" in navigator)) return;
  registering = true;
  const container = navigator.serviceWorker;
  // 初回インストール（制御されていない → clientsClaim で制御される）は更新ではない
  let hadController = Boolean(container.controller);
  container.addEventListener("controllerchange", () => {
    if (reloadRequested) {
      window.location.reload();
      return;
    }
    if (hadController) setState({ updateWaiting: false, updatedElsewhere: true });
    hadController = true;
  });
  void import("workbox-window")
    .then(async ({ Workbox }) => {
      const wb = new Workbox(SW_URL, { scope: SW_SCOPE });
      workbox = wb;
      // 既に制御中のページがあるときに新しい版が入ると waiting になる（初回インストールでは来ない）
      wb.addEventListener("waiting", () => setState({ updateWaiting: true }));
      registration = (await wb.register()) ?? null;
      window.setInterval(() => {
        void wb.update().catch(() => {});
      }, UPDATE_INTERVAL_MS);
    })
    .catch(() => {
      // 登録の失敗（プライベートモード等）でページを壊さない
    });
}

/**
 * 待機中の新しい版に切り替えて再読み込みする。
 * 他のタブが先に切り替えて待機中の版が無くなっていれば、そのまま再読み込みする
 */
export function applyUpdate(): void {
  const waiting = registration?.waiting;
  if (!workbox || !waiting) {
    window.location.reload();
    return;
  }
  reloadRequested = true;
  waiting.postMessage({ type: "SKIP_WAITING" });
}

export function dismissUpdate(): void {
  setState({ updateWaiting: false, updatedElsewhere: false });
}

/** インストールのダイアログを出す */
export async function promptInstall(): Promise<void> {
  const prompt = deferredPrompt;
  if (!prompt) return;
  deferredPrompt = null;
  setState({ canInstall: false });
  try {
    await prompt.prompt();
    await prompt.userChoice;
  } catch {
    // 何もしない
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePwaState(): PwaState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER_STATE,
  );
}
