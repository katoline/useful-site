/**
 * ツールの作業状態（入力画像・設定・結果）を置く場所。
 *
 * root.tsx の App（ルートより上）で配るので、言語切り替え（/convert/x ⇄ /en/convert/x の
 * クライアント側遷移）でルートのコンポーネントが作り直されても状態は残る（plan.md §9.2）。
 * ツールの状態はルートコンポーネントの useState ではなく、ここの useToolSession() に置くこと。
 *
 * 再読み込みでは消える（保存しない。DB を持たない方針）。File / Blob もそのまま置ける。
 */
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

type Listener = () => void;

export class ToolSessionStore {
  private values = new Map<string, unknown>();
  private listeners = new Map<string, Set<Listener>>();

  has(key: string): boolean {
    return this.values.has(key);
  }

  get<T>(key: string): T | undefined {
    return this.values.get(key) as T | undefined;
  }

  set<T>(key: string, value: T): void {
    if (this.values.has(key) && Object.is(this.values.get(key), value)) return;
    this.values.set(key, value);
    this.emit(key);
  }

  delete(key: string): void {
    if (!this.values.delete(key)) return;
    this.emit(key);
  }

  /** 接頭辞が一致するキーをまとめて消す（例 "convert:"） */
  clear(prefix = ""): void {
    for (const key of [...this.values.keys()]) {
      if (key.startsWith(prefix)) this.delete(key);
    }
  }

  subscribe(key: string, listener: Listener): () => void {
    let set = this.listeners.get(key);
    if (!set) {
      set = new Set();
      this.listeners.set(key, set);
    }
    set.add(listener);
    return () => set.delete(listener);
  }

  private emit(key: string) {
    for (const listener of this.listeners.get(key) ?? []) listener();
  }
}

const ToolSessionContext = createContext<ToolSessionStore | null>(null);

export function ToolSessionProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => new ToolSessionStore());
  return <ToolSessionContext.Provider value={store}>{children}</ToolSessionContext.Provider>;
}

export function useToolSessionStore(): ToolSessionStore {
  const store = useContext(ToolSessionContext);
  if (!store) throw new Error("ToolSessionProvider の内側で使ってください");
  return store;
}

type SetStateAction<T> = T | ((prev: T) => T);

/**
 * useState と同じ使い方で、状態を ToolSessionStore に置く。
 * key はツールごとに名前空間を付ける（例 "convert:files"、"icons:settings"）。
 */
export function useToolSession<T>(
  key: string,
  initial: T | (() => T),
): [T, (action: SetStateAction<T>) => void] {
  const store = useToolSessionStore();
  // 初期値は key ごとに持つ。同じコンポーネントのまま key だけ変わったら、その時点の initial で作り直す
  // （前の key の初期値を新しい key に使わない）
  const initialRef = useRef<{ key: string; value: T } | null>(null);
  if (initialRef.current === null || initialRef.current.key !== key) {
    initialRef.current = {
      key,
      value: typeof initial === "function" ? (initial as () => T)() : initial,
    };
  }
  const fallback = initialRef.current.value;

  const subscribe = useCallback((l: Listener) => store.subscribe(key, l), [store, key]);
  const getSnapshot = () => (store.has(key) ? (store.get<T>(key) as T) : fallback);
  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setValue = useCallback(
    (action: SetStateAction<T>) => {
      const prev = store.has(key) ? (store.get<T>(key) as T) : fallback;
      const next = typeof action === "function" ? (action as (p: T) => T)(prev) : action;
      store.set(key, next);
    },
    [store, key, fallback],
  );

  return [value, setValue];
}
