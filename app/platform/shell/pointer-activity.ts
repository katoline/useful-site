/**
 * 進行中のポインター操作（pointerdown から pointerup / pointercancel / blur / pagehide まで）を追跡する。
 *
 * 画面下の通知（BottomNotice）がハイドレーション直後に初回表示されると、利用者がフッターのリンクを
 * 押してから離すまでの間に通知が現れ、離した位置の通知のリンクが click を受け取ってしまうことがある
 * （click は押下と解放の共通祖先に届く）。そこで通知の初回表示だけ、操作が終わって click が済むまで
 * 遅らせる。このモジュールはその判定材料になる。
 *
 * ハイドレーション前の pointerdown も拾う必要があるので、実際の購読は root.tsx の <head> で実行する
 * POINTER_ACTIVITY_SCRIPT が担う（SSR・プリレンダリングの HTML にも入る静的スクリプト）。ここはその
 * 状態を読む側で、スクリプトが動いていない環境（テストなど）では自分で購読を張る。SSR・
 * プリレンダリングでは window が無いので getPointerActivity() は null を返し、購読はクライアントの
 * effect からのみ行う。
 */
import { useEffect, useState } from "react";
import { serializeInlineJson } from "../serialization.ts";

/** スクリプトとここで共有する window のプロパティ名 */
export const POINTER_ACTIVITY_KEY = "__bottomNoticePointerActivity";

export interface PointerActivity {
  /** いずれかのポインターが押されている間 true */
  isActive(): boolean;
  /** 状態が変わったときに呼ばれる。解除関数を返す */
  subscribe(listener: () => void): () => void;
}

function isPointerActivity(value: unknown): value is PointerActivity {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<PointerActivity>;
  return typeof candidate.isActive === "function" && typeof candidate.subscribe === "function";
}

function globalHolder(): Record<string, unknown> | null {
  return typeof window === "undefined" ? null : (window as unknown as Record<string, unknown>);
}

/**
 * <head> で実行するブートストラップ。ハイドレーション前に始まった操作も拾うため、
 * capture で window に pointerdown / pointerup / pointercancel を張り、pointerId の Set を保つ。
 * 解放されないままウィンドウを離れた場合に備えて blur / pagehide で全解放する（blur は capture にせず、
 * ウィンドウ自身が焦点を失ったときだけにする。要素の blur は capture では window にも届いてしまう）。
 * POINTER_ACTIVITY_KEY のオブジェクト経由で getPointerActivity() と購読を共有する。
 */
export const POINTER_ACTIVITY_SCRIPT = `(function(){try{var k=${serializeInlineJson(
  POINTER_ACTIVITY_KEY,
)};var w=window;if(w[k])return;var s=new Set(),f=[];function n(){for(var i=0;i<f.length;i++){try{f[i]()}catch(e){}}}function a(v){if(!s.has(v)){s.add(v);n()}}function r(v){if(s.delete(v))n()}function c(){if(s.size){s.clear();n()}}w[k]={isActive:function(){return s.size>0},subscribe:function(g){f.push(g);return function(){var i=f.indexOf(g);if(i>=0)f.splice(i,1)}}};w.addEventListener("pointerdown",function(e){a(e.pointerId)},true);w.addEventListener("pointerup",function(e){r(e.pointerId)},true);w.addEventListener("pointercancel",function(e){r(e.pointerId)},true);w.addEventListener("blur",c);w.addEventListener("pagehide",c)}catch(e){}})();`;

/** 追跡対象を読む。スクリプトが無ければ購読を張って作る。window が無い（SSR 等）ときは null */
export function getPointerActivity(): PointerActivity | null {
  const holder = globalHolder();
  if (!holder) return null;
  const existing = holder[POINTER_ACTIVITY_KEY];
  if (isPointerActivity(existing)) return existing;
  return installPointerActivity(holder);
}

/** ブートストラップと同じ契約で購読を張る（スクリプトが動いていない環境向け） */
function installPointerActivity(holder: Record<string, unknown>): PointerActivity {
  const active = new Set<number>();
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const listener of [...listeners]) listener();
  };
  const add = (pointerId: number) => {
    if (active.has(pointerId)) return;
    active.add(pointerId);
    emit();
  };
  const remove = (pointerId: number) => {
    if (active.delete(pointerId)) emit();
  };
  const clear = () => {
    if (active.size === 0) return;
    active.clear();
    emit();
  };
  const win = window;
  win.addEventListener("pointerdown", (event) => add(event.pointerId), true);
  win.addEventListener("pointerup", (event) => remove(event.pointerId), true);
  win.addEventListener("pointercancel", (event) => remove(event.pointerId), true);
  // blur は capture にしない（要素の blur も capture では window に届いてしまう）
  win.addEventListener("blur", clear);
  win.addEventListener("pagehide", clear);
  const activity: PointerActivity = {
    isActive: () => active.size > 0,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  holder[POINTER_ACTIVITY_KEY] = activity;
  return activity;
}

/**
 * 初回表示のゲート。まだ表示していない間だけ、進行中のポインター操作が終わるまで false を返す。
 * 一度 true になったら、そのあと操作が始まっても true のまま（既に出ている通知は消さず操作可能にする）。
 *
 * 解除は pointerup / pointercancel / blur / pagehide。pointerup の直後はまだ click が処理中なので、
 * すぐには表示せず次の描画フレームで active が空であることを再確認してから true にする（フレームは
 * click の後・描画の前に来るので、表示で click を奪わない）。待っている間に新しい pointerdown が
 * 来たら保留を続ける。
 */
export function useDeferredFirstShow(): boolean {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (shown) return;
    const activity = getPointerActivity();
    if (!activity) {
      // 購読できない（window が無い等）なら、表示を止めない
      setShown(true);
      return;
    }
    let frame = 0;
    let unsubscribe: (() => void) | null = null;
    const stop = () => {
      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
      unsubscribe?.();
      unsubscribe = null;
    };
    const check = () => {
      frame = 0;
      if (activity.isActive()) return; // まだ操作中。解除の通知を待つ
      stop();
      setShown(true);
    };
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(check);
    };
    unsubscribe = activity.subscribe(() => {
      if (!activity.isActive()) schedule();
    });
    // 最初は必ず 1 フレーム待つ（押下直後で click がまだ来ていない場合に表示で奪わない）
    schedule();
    return stop;
  }, [shown]);

  return shown;
}
