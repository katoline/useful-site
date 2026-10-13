/**
 * AdSense のスクリプトを読み込む（root から 1 回だけ置く）。描画するものは無い。
 *
 * - VITE_ADSENSE_CLIENT が `ca-pub-<数字>` のときだけ読む
 * - ハイドレーション後（useEffect）、表示が落ち着いてから（requestIdleCallback、無ければ load 後の setTimeout）
 * - オフラインでは読まない（オンラインに戻ったら読む）
 * - 1 ページで 1 回だけ（loader.ts がモジュールの状態で重複を防ぐ。クライアント側遷移でも入れ直さない）
 */
import { useEffect } from "react";
import { useOnline } from "../hooks/use-online";
import { getAdClient } from "./config";
import { loadAdSenseScript, scheduleWhenIdle } from "./loader";

export function AdSenseScript() {
  const online = useOnline();
  useEffect(() => {
    const client = getAdClient();
    if (!client || !online) return;
    return scheduleWhenIdle(() => {
      if (navigator.onLine) void loadAdSenseScript(client);
    });
  }, [online]);
  return null;
}
