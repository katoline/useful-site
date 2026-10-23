/**
 * 計測の進行：入力を開き、FRAME_INTERVAL_MS ごとに解析し、時間が来るか停止で集計する。
 * 入力（マイク）はページから注入する。画面を離れたらマイクを止める
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { FRAME_INTERVAL_MS, SILENCE_DBFS } from "../../../domain/limits";
import type { FrameAnalysis, MeasurementSummary } from "../../../domain/measurement";
import { analyzeFrame, summarize } from "../core/analyze";
import {
  type AudioInput,
  AudioInputError,
  type AudioInputErrorKind,
  type OpenAudioInput,
} from "../core/port";
import { spectrumBars } from "../core/spectrum";

/** 表示用の棒の本数と範囲 */
export const BAR_COUNT = 32;
export const BAR_MIN_HZ = 50;
export const BAR_MAX_HZ = 16000;
export const BAR_FLOOR_DB = -120;
/** 計測の始めは解析器の中が空（すべて 0）なので、この時間までの無音は数えない */
const WARMUP_MS = 500;

export type MeasurementStatus = "idle" | "starting" | "measuring";

export interface LiveView {
  frame: FrameAnalysis;
  bars: number[];
}

export interface MeasurementResult {
  frames: FrameAnalysis[];
  summary: MeasurementSummary;
}

export function useMeasurement({
  openInput,
  durationMs,
  onComplete,
}: {
  openInput: OpenAudioInput;
  durationMs: number;
  onComplete(result: MeasurementResult): void;
}) {
  const [status, setStatus] = useState<MeasurementStatus>("idle");
  const [error, setError] = useState<AudioInputErrorKind | null>(null);
  const [live, setLive] = useState<LiveView | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const inputRef = useRef<AudioInput | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const framesRef = useRef<FrameAnalysis[]>([]);
  const elapsedRef = useRef(0);
  const mountedRef = useRef(true);
  /** 開始の処理中（マイクを開くまでの間）。ボタンの連打で 2 回開かないようにする */
  const startingRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const release = useCallback(() => {
    if (timerRef.current !== null) clearInterval(timerRef.current);
    timerRef.current = null;
    inputRef.current?.close();
    inputRef.current = null;
  }, []);

  const finish = useCallback(() => {
    release();
    const frames = framesRef.current;
    framesRef.current = [];
    setStatus("idle");
    setLive(null);
    if (frames.length > 0) {
      onCompleteRef.current({ frames, summary: summarize(frames, elapsedRef.current) });
    }
  }, [release]);

  const start = useCallback(async () => {
    if (startingRef.current || inputRef.current || timerRef.current !== null) return;
    startingRef.current = true;
    setError(null);
    setStatus("starting");
    let input: AudioInput;
    try {
      input = await openInput();
    } catch (cause) {
      startingRef.current = false;
      if (!mountedRef.current) return;
      setStatus("idle");
      setError(cause instanceof AudioInputError ? cause.kind : "unknown");
      return;
    }
    startingRef.current = false;
    if (!mountedRef.current) {
      input.close();
      return;
    }
    inputRef.current = input;
    framesRef.current = [];
    elapsedRef.current = 0;
    setElapsedMs(0);
    setStatus("measuring");
    const startedAt = performance.now();
    timerRef.current = setInterval(() => {
      const timeMs = Math.min(durationMs, performance.now() - startedAt);
      const audio = input.read();
      const frame = analyzeFrame(audio, timeMs);
      const warmingUp = timeMs < WARMUP_MS && frame.levelDbfs <= SILENCE_DBFS;
      if (!warmingUp) framesRef.current.push(frame);
      elapsedRef.current = timeMs;
      setElapsedMs(timeMs);
      setLive({
        frame,
        bars: spectrumBars(
          audio.spectrumDb,
          audio.sampleRate,
          BAR_COUNT,
          BAR_MIN_HZ,
          BAR_MAX_HZ,
          BAR_FLOOR_DB,
        ),
      });
      // 時間が来たか、マイクが途中で切れたら（以降は無音しか来ない）そこで集計する
      if (timeMs >= durationMs || !input.isActive()) finish();
    }, FRAME_INTERVAL_MS);
  }, [openInput, durationMs, finish]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      release();
    };
  }, [release]);

  return { status, error, live, elapsedMs, start, stop: finish };
}
