// @vitest-environment happy-dom
import { act, cleanup, render } from "@testing-library/react";
import { StrictMode, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdSenseScript } from "~/platform/ads/AdSenseScript";
import { AdSlot } from "~/platform/ads/AdSlot";
import { normalizeAdClient, normalizeAdSlotId } from "~/platform/ads/config";
import { resetAdSenseLoaderForTest } from "~/platform/ads/loader";
import { I18nProvider } from "~/platform/i18n";

const SCRIPT_SELECTOR =
  'script[src^="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]';

/** IntersectionObserver の代わり。trigger() で交差を起こす */
class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  readonly targets = new Set<Element>();
  disconnected = false;
  constructor(
    readonly callback: IntersectionObserverCallback,
    readonly options?: IntersectionObserverInit,
  ) {
    FakeIntersectionObserver.instances.push(this);
  }
  observe(target: Element) {
    this.targets.add(target);
  }
  unobserve(target: Element) {
    this.targets.delete(target);
  }
  disconnect() {
    this.disconnected = true;
    this.targets.clear();
  }
  takeRecords() {
    return [];
  }
  static triggerAll() {
    for (const observer of FakeIntersectionObserver.instances) {
      if (observer.disconnected) continue;
      const entries = [...observer.targets].map(
        (target) => ({ target, isIntersecting: true }) as IntersectionObserverEntry,
      );
      if (entries.length > 0)
        observer.callback(entries, observer as unknown as IntersectionObserver);
    }
  }
}

/** requestIdleCallback をすぐ呼ぶ */
function immediateIdle(cb: IdleRequestCallback): number {
  cb({ didTimeout: false, timeRemaining: () => 50 });
  return 1;
}

function scripts() {
  return document.querySelectorAll(SCRIPT_SELECTOR);
}

/** 入れたスクリプトの読み込み完了を起こす（実際には取得しない） */
async function finishScriptLoad() {
  await act(async () => {
    for (const script of scripts()) script.dispatchEvent(new Event("load"));
    await Promise.resolve();
  });
}

function renderWithI18n(ui: React.ReactNode) {
  return render(
    <StrictMode>
      <I18nProvider lang="ja">{ui}</I18nProvider>
    </StrictMode>,
  );
}

let push: ReturnType<typeof vi.fn>;

beforeEach(() => {
  resetAdSenseLoaderForTest();
  FakeIntersectionObserver.instances = [];
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  vi.stubGlobal("requestIdleCallback", immediateIdle);
  vi.stubGlobal("cancelIdleCallback", () => {});
  push = vi.fn();
  window.adsbygoogle = { push } as unknown as unknown[];
});

afterEach(() => {
  cleanup();
  for (const script of scripts()) script.remove();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete window.adsbygoogle;
});

function configure() {
  vi.stubEnv("VITE_ADSENSE_CLIENT", "ca-pub-1234567890");
  vi.stubEnv("VITE_ADSENSE_SLOT_RESPONSIVE", "1111111111");
}

describe("設定値の検証", () => {
  it("クライアント ID は ca-pub-<数字>、広告ユニット ID は数字だけを受け付ける", () => {
    expect(normalizeAdClient(" ca-pub-123 ")).toBe("ca-pub-123");
    expect(normalizeAdClient("pub-123")).toBeNull();
    expect(normalizeAdClient("")).toBeNull();
    expect(normalizeAdSlotId("0123")).toBe("0123");
    expect(normalizeAdSlotId("12a")).toBeNull();
    expect(normalizeAdSlotId(undefined)).toBeNull();
  });
});

describe("AdSenseScript", () => {
  it("VITE_ADSENSE_CLIENT が未設定ならスクリプトを入れない", () => {
    vi.stubEnv("VITE_ADSENSE_CLIENT", "");
    renderWithI18n(<AdSenseScript />);
    expect(scripts()).toHaveLength(0);
  });

  it("設定時は async・crossorigin 付きで 1 回だけ入れる（StrictMode・再マウントでも）", () => {
    configure();
    const first = renderWithI18n(<AdSenseScript />);
    first.unmount();
    renderWithI18n(<AdSenseScript />);
    const found = scripts();
    expect(found).toHaveLength(1);
    const script = found[0] as HTMLScriptElement;
    expect(script.async).toBe(true);
    expect(script.getAttribute("crossorigin")).toBe("anonymous");
    expect(script.src).toBe(
      "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1234567890",
    );
  });

  it("オフラインでは読み込まない", () => {
    configure();
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    renderWithI18n(<AdSenseScript />);
    expect(scripts()).toHaveLength(0);
  });
});

describe("AdSlot", () => {
  it("画面に近づき、スクリプトが読み込まれるまで push しない。2 回 push しない", async () => {
    configure();
    const { container } = renderWithI18n(
      <>
        <AdSenseScript />
        <AdSlot format="responsive" />
      </>,
    );
    const ins = container.querySelector("ins");
    expect(ins?.getAttribute("data-ad-slot")).toBe("1111111111");
    expect(ins?.classList.contains("adsbygoogle")).toBe(false);

    // スクリプトの読み込みが終わっても、交差するまでは push しない
    await finishScriptLoad();
    expect(push).not.toHaveBeenCalled();

    await act(async () => {
      FakeIntersectionObserver.triggerAll();
      await Promise.resolve();
    });
    expect(push).toHaveBeenCalledTimes(1);
    expect(ins?.classList.contains("adsbygoogle")).toBe(true);

    // 再度交差しても、再描画しても 2 回目は押さない
    await act(async () => {
      FakeIntersectionObserver.triggerAll();
      await Promise.resolve();
    });
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("オフライン→オンラインで作り直された枠も埋め直す", async () => {
    configure();
    const onLine = vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    const { container } = renderWithI18n(
      <>
        <AdSenseScript />
        <AdSlot format="responsive" />
      </>,
    );
    await finishScriptLoad();
    await act(async () => {
      FakeIntersectionObserver.triggerAll();
      await Promise.resolve();
    });
    expect(push).toHaveBeenCalledTimes(1);

    const setOnline = async (value: boolean) => {
      onLine.mockReturnValue(value);
      await act(async () => {
        window.dispatchEvent(new Event(value ? "online" : "offline"));
        await Promise.resolve();
      });
    };
    await setOnline(false);
    expect(container.querySelector("ins")).toBeNull();
    await setOnline(true);
    const ins = container.querySelector("ins");
    expect(ins?.classList.contains("adsbygoogle")).toBe(true);
    expect(push).toHaveBeenCalledTimes(2);
  });

  it("スクリプトの読み込みに失敗したら、オンラインに戻ったときに入れ直す", async () => {
    configure();
    const onLine = vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    renderWithI18n(<AdSenseScript />);
    expect(scripts()).toHaveLength(1);
    const failed = scripts()[0];
    await act(async () => {
      failed?.dispatchEvent(new Event("error"));
      await Promise.resolve();
    });

    for (const value of [false, true]) {
      onLine.mockReturnValue(value);
      await act(async () => {
        window.dispatchEvent(new Event(value ? "online" : "offline"));
        await Promise.resolve();
      });
    }
    // 失敗した要素を外して 1 本だけ入れ直す
    const retried = scripts();
    expect(retried).toHaveLength(1);
    expect(retried[0]).not.toBe(failed);
  });

  it("交差していてもスクリプトの読み込みが終わるまでは push しない", async () => {
    configure();
    renderWithI18n(
      <>
        <AdSenseScript />
        <AdSlot format="responsive" />
      </>,
    );
    await act(async () => {
      FakeIntersectionObserver.triggerAll();
      await Promise.resolve();
    });
    expect(push).not.toHaveBeenCalled();
    await finishScriptLoad();
    await act(async () => {
      await Promise.resolve();
    });
    expect(push).toHaveBeenCalledTimes(1);
  });

  function mockSlotVisibility() {
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockImplementation(function (
      this: HTMLElement,
    ) {
      const visible = !this.closest("[hidden]");
      return { length: visible ? 1 : 0, item: () => null } as unknown as DOMRectList;
    });
  }

  function fourSlots(hidden = false) {
    return (
      <>
        <AdSlot format="responsive" />
        <AdSlot format="responsive" />
        <AdSlot format="responsive" />
        <div hidden={hidden}>
          <AdSlot format="responsive" />
        </div>
      </>
    );
  }

  it("4 つ目の枠も描画し、開発時は表示枠数の超過を警告する", () => {
    configure();
    mockSlotVisibility();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = renderWithI18n(fourSlots());
    expect(container.querySelectorAll("aside")).toHaveLength(4);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("配置を見直してください"));
  });

  it("CSS で非表示の枠は数えず、画面幅の変更時に再確認する", () => {
    configure();
    mockSlotVisibility();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = renderWithI18n(fourSlots(true));
    expect(container.querySelectorAll("aside")).toHaveLength(4);
    expect(warn).not.toHaveBeenCalled();
    container.querySelector("[hidden]")?.removeAttribute("hidden");
    act(() => window.dispatchEvent(new Event("resize")));
    expect(warn).toHaveBeenCalled();
  });

  it("既存の枠の間に追加した枠も、表示枠数の超過を警告する", () => {
    configure();
    mockSlotVisibility();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    let showSlot: () => void = () => {};
    function AdditionalSlot() {
      const [shown, setShown] = useState(false);
      showSlot = () => setShown(true);
      return shown ? <AdSlot format="responsive" /> : null;
    }
    const { container } = renderWithI18n(
      <>
        <AdSlot format="responsive" />
        <AdditionalSlot />
        <AdSlot format="responsive" />
        <AdSlot format="responsive" />
      </>,
    );
    expect(warn).not.toHaveBeenCalled();
    act(() => showSlot());
    expect(container.querySelectorAll("aside")).toHaveLength(4);
    expect(warn).toHaveBeenCalled();
  });

  it("遷移で前のページの枠が消えたら、現在の表示枠だけを数える", () => {
    configure();
    mockSlotVisibility();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const previous = renderWithI18n(fourSlots());
    expect(warn).toHaveBeenCalled();
    previous.unmount();
    warn.mockClear();
    const { container } = renderWithI18n(<AdSlot format="responsive" />);
    expect(container.querySelectorAll("aside")).toHaveLength(1);
    expect(warn).not.toHaveBeenCalled();
  });

  it("本番では 4 つ目の枠も描画し、枠数の警告を出さない", () => {
    configure();
    vi.stubEnv("DEV", false);
    mockSlotVisibility();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = renderWithI18n(fourSlots());
    expect(container.querySelectorAll("aside")).toHaveLength(4);
    expect(warn).not.toHaveBeenCalled();
  });

  it("広告ユニット ID が無い形式は、開発時は破線のプレースホルダーで push しない", () => {
    vi.stubEnv("VITE_ADSENSE_CLIENT", "ca-pub-1234567890");
    vi.stubEnv("VITE_ADSENSE_SLOT_BANNER", "");
    const { container } = renderWithI18n(<AdSlot format="banner" />);
    expect(container.querySelector("ins")).toBeNull();
    expect(container.querySelector("aside")?.className).toContain("border-dashed");
  });
});
