// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** navigator.serviceWorker と workbox-window の Workbox を差し替える */
function setup(options: { controller: boolean; waiting: boolean }) {
  const container = new EventTarget() as EventTarget & { controller: object | null };
  container.controller = options.controller ? {} : null;
  Object.defineProperty(navigator, "serviceWorker", { value: container, configurable: true });

  const postMessage = vi.fn();
  const registration = { waiting: options.waiting ? { postMessage } : null };
  vi.doMock("workbox-window", () => ({
    Workbox: class {
      addEventListener() {}
      register = async () => registration;
      update = async () => {};
    },
  }));
  const reload = vi.fn();
  Object.defineProperty(window, "location", {
    value: { ...window.location, reload },
    configurable: true,
  });
  return { container, postMessage, registration, reload };
}

async function loadStore() {
  const store = await import("~/apps/image-adjust/components/pwa/pwa-store");
  store.registerServiceWorker();
  // 動的 import と register() の完了を待つ
  await new Promise((r) => setTimeout(r, 10));
  return store;
}

describe("pwa-store の更新", () => {
  const originalLocation = window.location;
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("DEV", false);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.doUnmock("workbox-window");
    Object.defineProperty(window, "location", { value: originalLocation, configurable: true });
  });

  it("待機中の版があれば SKIP_WAITING を送り、切り替わったら再読み込みする", async () => {
    const env = setup({ controller: true, waiting: true });
    const store = await loadStore();
    store.applyUpdate();
    expect(env.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    expect(env.reload).not.toHaveBeenCalled();
    env.container.dispatchEvent(new Event("controllerchange"));
    expect(env.reload).toHaveBeenCalledOnce();
  });

  it("他のタブが先に切り替えて待機中の版が無ければ、すぐ再読み込みする", async () => {
    const env = setup({ controller: true, waiting: true });
    const store = await loadStore();
    env.registration.waiting = null;
    store.applyUpdate();
    expect(env.postMessage).not.toHaveBeenCalled();
    expect(env.reload).toHaveBeenCalledOnce();
  });

  it("他のタブがきっかけで切り替わったら、自動で再読み込みせず案内を出す", async () => {
    const env = setup({ controller: true, waiting: false });
    const store = await loadStore();
    env.container.dispatchEvent(new Event("controllerchange"));
    expect(env.reload).not.toHaveBeenCalled();
    const { result } = await renderState(store);
    expect(result).toMatchObject({ updatedElsewhere: true, updateWaiting: false });
  });

  it("初回インストールで制御されたときは案内を出さない", async () => {
    const env = setup({ controller: false, waiting: false });
    const store = await loadStore();
    env.container.dispatchEvent(new Event("controllerchange"));
    const { result } = await renderState(store);
    expect(result.updatedElsewhere).toBe(false);
    expect(env.reload).not.toHaveBeenCalled();
  });
});

/** usePwaState() の現在値を読む */
async function renderState(store: typeof import("~/apps/image-adjust/components/pwa/pwa-store")) {
  const { renderHook } = await import("@testing-library/react");
  const { result } = renderHook(() => store.usePwaState());
  return { result: result.current };
}
