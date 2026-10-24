/** 測定の進行（開始・中止・進み具合・結果・エラー）。通信の実装はページから注入する */
import { useCallback, useEffect, useRef, useState } from "react";
import type { SpeedTestResult } from "../../../domain/measurement";
import { SpeedTestError, type SpeedTestErrorKind, type SpeedTestTransport } from "../core/port";
import { runSpeedTest, type SpeedTestProgress } from "../core/runner";

export type SpeedTestStatus = "idle" | "running";

export function useSpeedTest({
  transport,
  onComplete,
}: {
  transport: SpeedTestTransport;
  onComplete(result: SpeedTestResult): void;
}) {
  const [status, setStatus] = useState<SpeedTestStatus>("idle");
  const [progress, setProgress] = useState<SpeedTestProgress | null>(null);
  const [error, setError] = useState<SpeedTestErrorKind | "canceled" | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const start = useCallback(async () => {
    if (controllerRef.current) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    setStatus("running");
    setError(null);
    setProgress(null);
    try {
      const result = await runSpeedTest(transport, {
        now: () => performance.now(),
        onProgress: (next) => {
          if (!controller.signal.aborted) setProgress(next);
        },
        signal: controller.signal,
      });
      if (!controller.signal.aborted) onCompleteRef.current(result);
    } catch (cause) {
      if (controller.signal.aborted) {
        setError("canceled");
      } else {
        setError(cause instanceof SpeedTestError ? cause.kind : "network");
      }
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      setStatus("idle");
      setProgress(null);
    }
  }, [transport]);

  const cancel = useCallback(() => controllerRef.current?.abort(), []);

  // 画面を離れたら測定を止める（通信し続けない）
  useEffect(() => () => controllerRef.current?.abort(), []);

  return { status, progress, error, start, cancel };
}
