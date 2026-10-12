/**
 * 画面下に重ねて出す通知（言語の案内・PWA の更新・受け取り件数）の置き場所。
 *
 * 通知ごとに fixed で置くと互いに重なり、ボタンが押せなくなる。そこで固定のコンテナを 1 つだけ置き、
 * 各通知は <BottomNotice> でそこへポータルして縦に積む。位置は bottom-above-action-bar
 * （スマホのツール画面の下固定バーがあればその上）。
 *
 * ハイドレーション後に出る通知をページの流れに入れるとレイアウトがずれる（CLS）ので、重ねて出す。
 * 代わりに、何か出ている間はコンテナの実際の高さを --bottom-notices-height に入れ、body の下に
 * 同じだけ余白を足してフッターを隠さない（app.css。末尾に足すだけなので表示中の要素は動かない）。
 */
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";

const HEIGHT_VAR = "--bottom-notices-height";

const BottomNoticesContext = createContext<HTMLElement | null>(null);

export function BottomNoticesProvider({ children }: { children: ReactNode }) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!container) return;
    const root = document.documentElement;
    const update = () => {
      const height = container.getBoundingClientRect().height;
      if (height > 0) root.style.setProperty(HEIGHT_VAR, `${Math.ceil(height)}px`);
      else root.style.removeProperty(HEIGHT_VAR);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => {
      observer.disconnect();
      root.style.removeProperty(HEIGHT_VAR);
    };
  }, [container]);

  return (
    <BottomNoticesContext.Provider value={container}>
      {children}
      {/* 隙間でページの操作を妨げないよう、コンテナ自体はポインターを通す（各通知で pointer-events-auto） */}
      <div
        ref={setContainer}
        data-bottom-notices
        data-testid="bottom-notices"
        className="bottom-above-action-bar pointer-events-none fixed inset-x-3 z-50 flex flex-col gap-2 md:right-4 md:left-auto md:w-full md:max-w-md"
      />
    </BottomNoticesContext.Provider>
  );
}

/** 画面下の通知のコンテナに出す。コンテナができるまで（プリレンダリング・ハイドレーション中）は何も出さない */
export function BottomNotice({ children }: { children: ReactNode }) {
  const container = useContext(BottomNoticesContext);
  return container ? createPortal(children, container) : null;
}
