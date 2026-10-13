import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** ハイドレーション後に true（プリレンダリング HTML とずれる値を出すときに使う） */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
