// @vitest-environment happy-dom
import { runInThisContext } from "node:vm";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BottomNotice, BottomNoticesProvider } from "./BottomNotices";
import {
  getPointerActivity,
  POINTER_ACTIVITY_KEY,
  POINTER_ACTIVITY_SCRIPT,
  type PointerActivity,
} from "./pointer-activity";

/** pointerdown 等を pointerId 付きで window に投げる（happy-dom の PointerEvent に依存しない） */
function pointer(type: "pointerdown" | "pointerup" | "pointercancel", pointerId: number) {
  const event = new Event(type);
  Object.defineProperty(event, "pointerId", { value: pointerId });
  window.dispatchEvent(event);
}

/** <head> のブートストラップスクリプトをこの window で実行する */
function runBootstrap() {
  runInThisContext(POINTER_ACTIVITY_SCRIPT);
}

function activity(): PointerActivity | undefined {
  return (window as unknown as Record<string, PointerActivity | undefined>)[POINTER_ACTIVITY_KEY];
}

// requestAnimationFrame を手動で進める（描画フレームのタイミングを確かめる）
let frames: Map<number, FrameRequestCallback>;
let nextFrameId: number;

function flushFrames() {
  const pending = [...frames.values()];
  frames.clear();
  act(() => {
    for (const callback of pending) callback(performance.now());
  });
}

beforeEach(() => {
  frames = new Map();
  nextFrameId = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const id = ++nextFrameId;
    frames.set(id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    frames.delete(id);
  });
});

afterEach(() => {
  cleanup();
  delete (window as unknown as Record<string, PointerActivity | undefined>)[POINTER_ACTIVITY_KEY];
  vi.unstubAllGlobals();
});

describe("pointer の追跡（ブートストラップスクリプト）", () => {
  it("pointerId ごとに pointerdown から解放までを追跡し、変化を購読に伝える", () => {
    runBootstrap();
    const tracker = activity();
    expect(tracker).toBeDefined();
    expect(tracker?.isActive()).toBe(false);

    const listener = vi.fn();
    const off = tracker?.subscribe(listener);
    pointer("pointerdown", 1);
    expect(tracker?.isActive()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    // 同じ pointerId の重複は数えない
    pointer("pointerdown", 1);
    expect(listener).toHaveBeenCalledTimes(1);
    pointer("pointerup", 1);
    expect(tracker?.isActive()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);

    off?.();
    pointer("pointerdown", 2);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("複数のポインターは、すべて解放されるまで active のまま", () => {
    runBootstrap();
    const tracker = activity();
    pointer("pointerdown", 1);
    pointer("pointerdown", 2);
    pointer("pointerup", 1);
    expect(tracker?.isActive()).toBe(true);
    pointer("pointerup", 2);
    expect(tracker?.isActive()).toBe(false);
  });

  it("pointercancel・blur・pagehide で解放する", () => {
    runBootstrap();
    const tracker = activity();
    pointer("pointerdown", 1);
    pointer("pointercancel", 1);
    expect(tracker?.isActive()).toBe(false);

    pointer("pointerdown", 1);
    pointer("pointerdown", 2);
    window.dispatchEvent(new Event("blur"));
    expect(tracker?.isActive()).toBe(false);

    pointer("pointerdown", 1);
    window.dispatchEvent(new Event("pagehide"));
    expect(tracker?.isActive()).toBe(false);
  });

  it("要素の blur では解放せず、ウィンドウの blur で解放する", () => {
    runBootstrap();
    const tracker = activity();
    const input = document.createElement("input");
    document.body.append(input);
    pointer("pointerdown", 1);
    // 要素の blur は window の（capture でない）listener には届かない
    input.dispatchEvent(new Event("blur"));
    expect(tracker?.isActive()).toBe(true);
    input.remove();
    window.dispatchEvent(new Event("blur"));
    expect(tracker?.isActive()).toBe(false);
  });

  it("二重に実行しても同じ状態を共有する", () => {
    runBootstrap();
    const first = activity();
    runBootstrap();
    expect(activity()).toBe(first);
  });

  it("スクリプトが無くても購読を張って追跡する（フォールバック）", () => {
    const tracker = getPointerActivity();
    expect(tracker).not.toBeNull();
    pointer("pointerdown", 5);
    expect(tracker?.isActive()).toBe(true);
    pointer("pointerup", 5);
    expect(tracker?.isActive()).toBe(false);
  });
});

function renderNotice() {
  return render(
    <BottomNoticesProvider>
      <BottomNotice>
        <div data-testid="notice">通知</div>
      </BottomNotice>
    </BottomNoticesProvider>,
  );
}

describe("通知の初回表示（useDeferredFirstShow）", () => {
  it("操作が無ければ次の描画フレームで表示する", () => {
    runBootstrap();
    const { queryByTestId } = renderNotice();
    expect(queryByTestId("notice")).toBeNull();
    flushFrames();
    expect(queryByTestId("notice")).not.toBeNull();
  });

  it("pointerdown 中は表示せず、pointerup の次のフレームで表示する（click を奪わない）", () => {
    runBootstrap();
    pointer("pointerdown", 1);
    const { queryByTestId } = renderNotice();
    // フレームが来ても、まだ押されている間は出さない
    flushFrames();
    expect(queryByTestId("notice")).toBeNull();

    pointer("pointerup", 1);
    flushFrames();
    expect(queryByTestId("notice")).not.toBeNull();
  });

  it("待機中に新しい pointerdown が来たら保留を続ける", () => {
    runBootstrap();
    pointer("pointerdown", 1);
    const { queryByTestId } = renderNotice();
    flushFrames();
    expect(queryByTestId("notice")).toBeNull();

    // 解放してフレームが来る前に、別のポインターが押された
    pointer("pointerup", 1);
    pointer("pointerdown", 2);
    flushFrames();
    expect(queryByTestId("notice")).toBeNull();

    pointer("pointerup", 2);
    flushFrames();
    expect(queryByTestId("notice")).not.toBeNull();
  });

  it("複数のポインターはすべて終わるまで表示しない", () => {
    runBootstrap();
    pointer("pointerdown", 1);
    pointer("pointerdown", 2);
    const { queryByTestId } = renderNotice();
    flushFrames();
    expect(queryByTestId("notice")).toBeNull();

    pointer("pointerup", 1);
    flushFrames();
    expect(queryByTestId("notice")).toBeNull();

    pointer("pointerup", 2);
    flushFrames();
    expect(queryByTestId("notice")).not.toBeNull();
  });

  it("pointercancel で待ちが解除される", () => {
    runBootstrap();
    pointer("pointerdown", 1);
    const { queryByTestId } = renderNotice();
    flushFrames();
    expect(queryByTestId("notice")).toBeNull();

    pointer("pointercancel", 1);
    flushFrames();
    expect(queryByTestId("notice")).not.toBeNull();
  });

  it("blur で待ちが解除される", () => {
    runBootstrap();
    pointer("pointerdown", 1);
    const { queryByTestId } = renderNotice();
    flushFrames();
    expect(queryByTestId("notice")).toBeNull();

    window.dispatchEvent(new Event("blur"));
    flushFrames();
    expect(queryByTestId("notice")).not.toBeNull();
  });

  it("一度出た通知は、あとで押しても消えず操作できる", () => {
    runBootstrap();
    const { queryByTestId } = renderNotice();
    flushFrames();
    expect(queryByTestId("notice")).not.toBeNull();

    pointer("pointerdown", 1);
    expect(queryByTestId("notice")).not.toBeNull();
    pointer("pointerup", 1);
    expect(queryByTestId("notice")).not.toBeNull();
  });
});
