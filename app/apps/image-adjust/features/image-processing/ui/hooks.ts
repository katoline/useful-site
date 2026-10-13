/**
 * ツール画面用の小さなフック。
 */
import { useEffect, useState } from "react";
import type { ImageFormat } from "../../../domain/format";
import { toPreviewBlob } from "../adapters/preview";

/**
 * 画面に出すプレビュー URL。SVG は canvas でラスタライズした PNG の URL になる（preview.ts）。
 * maxEdge を渡すと縮小したサムネイルにする。blob が変わるか unmount で revoke する。
 */
export function usePreviewUrl(
  blob: Blob | null | undefined,
  format: ImageFormat | null,
  maxEdge?: number,
): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    let active = true;
    let created: string | null = null;
    toPreviewBlob(blob, format, maxEdge).then((preview) => {
      if (!active || !preview) return;
      created = URL.createObjectURL(preview);
      setUrl(created);
    });
    return () => {
      active = false;
      if (created) URL.revokeObjectURL(created);
      setUrl(null);
    };
  }, [blob, format, maxEdge]);
  return url;
}

interface WakeLockSentinelLike {
  release(): Promise<void>;
  addEventListener(type: "release", listener: () => void): void;
}

/**
 * 処理中は画面を点けたままにする（Screen Wake Lock API。対応ブラウザのみ。§6.2）。
 * タブが隠れると OS が解放するので、release を監視して表示に戻ったら取り直す。
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof navigator === "undefined") return;
    const wakeLock = (
      navigator as Navigator & {
        wakeLock?: { request(type: "screen"): Promise<WakeLockSentinelLike> };
      }
    ).wakeLock;
    if (!wakeLock) return;
    let sentinel: WakeLockSentinelLike | null = null;
    let stopped = false;
    const acquire = async () => {
      if (stopped || sentinel) return;
      try {
        const s = await wakeLock.request("screen");
        if (stopped) {
          await s.release();
          return;
        }
        sentinel = s;
        s.addEventListener("release", () => {
          if (sentinel === s) sentinel = null;
        });
      } catch {
        // 省電力モード等で拒否される。処理には影響しない
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisible);
      void sentinel?.release();
      sentinel = null;
    };
  }, [active]);
}
