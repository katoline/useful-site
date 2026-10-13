// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ToolSessionProvider, useToolSession } from "~/platform/state/ToolSessionProvider";

const wrapper = ({ children }: { children: ReactNode }) => (
  <ToolSessionProvider>{children}</ToolSessionProvider>
);

describe("useToolSession", () => {
  it("同じコンポーネントのまま key が変わると、新しい key ではその時点の initial を使う", () => {
    const { result, rerender } = renderHook(
      ({ k, initial }: { k: string; initial: number }) => useToolSession(k, initial),
      { wrapper, initialProps: { k: "test:a", initial: 1 } },
    );
    expect(result.current[0]).toBe(1);

    rerender({ k: "test:b", initial: 2 });
    expect(result.current[0]).toBe(2);

    // 関数での更新も新しい key の初期値から計算する
    act(() => result.current[1]((prev) => prev + 10));
    expect(result.current[0]).toBe(12);
  });

  it("key が同じあいだは初期化関数を呼び直さず、値も保つ", () => {
    const init = vi.fn(() => 5);
    const { result, rerender } = renderHook(({ k }: { k: string }) => useToolSession(k, init), {
      wrapper,
      initialProps: { k: "test:a" },
    });
    rerender({ k: "test:a" });
    expect(init).toHaveBeenCalledTimes(1);
    expect(result.current[0]).toBe(5);

    act(() => result.current[1](7));
    rerender({ k: "test:b" });
    expect(init).toHaveBeenCalledTimes(2);
    expect(result.current[0]).toBe(5);

    // 元の key に戻ると、保存済みの値が出る
    rerender({ k: "test:a" });
    expect(result.current[0]).toBe(7);
  });
});
