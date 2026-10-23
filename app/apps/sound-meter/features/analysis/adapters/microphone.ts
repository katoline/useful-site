/**
 * マイクの入力（getUserMedia ＋ Web Audio の AnalyserNode）。音は端末の中で解析するだけで、録音も送信もしない。
 * 計測の値が変わらないよう、エコー除去・雑音抑制・自動音量調整は切る（効くかは端末次第）
 */
import { FFT_SIZE } from "../../../domain/limits";
import { type AudioInput, AudioInputError, type OpenAudioInput } from "../core/port";

function errorKind(error: unknown): AudioInputError["kind"] {
  const name = error instanceof Error || error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "permission";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "not-found";
  if (name === "NotReadableError" || name === "AbortError") return "in-use";
  return "unknown";
}

export const openMicrophone: OpenAudioInput = async () => {
  const AudioContextClass = typeof window === "undefined" ? undefined : window.AudioContext;
  if (!navigator.mediaDevices?.getUserMedia || !AudioContextClass) {
    throw new AudioInputError("unsupported");
  }
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  } catch (error) {
    throw new AudioInputError(errorKind(error), { cause: error });
  }

  const context = new AudioContextClass();
  const stopAll = () => {
    for (const track of stream.getTracks()) track.stop();
    void context.close().catch(() => undefined);
  };
  try {
    // iOS Safari は止まった状態で作られることがある（ボタンの操作の中なので再開できる）
    if (context.state === "suspended") await context.resume();
    const analyser = context.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = 0;
    // スピーカーには繋がない（ハウリングしない）
    context.createMediaStreamSource(stream).connect(analyser);

    const samples = new Float32Array(analyser.fftSize);
    const spectrumDb = new Float32Array(analyser.frequencyBinCount);
    let closed = false;
    const input: AudioInput = {
      read() {
        analyser.getFloatTimeDomainData(samples);
        analyser.getFloatFrequencyData(spectrumDb);
        return { samples, spectrumDb, sampleRate: context.sampleRate };
      },
      close() {
        if (closed) return;
        closed = true;
        stopAll();
      },
    };
    return input;
  } catch (error) {
    stopAll();
    throw new AudioInputError("unknown", { cause: error });
  }
};
