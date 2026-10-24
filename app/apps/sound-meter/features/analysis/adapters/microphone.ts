/**
 * マイクの入力（getUserMedia ＋ Web Audio の AnalyserNode）。音は端末の中で解析するだけで、録音も送信もしない。
 * 計測の値が変わらないよう、エコー除去・雑音抑制・自動音量調整は切る（効くかは端末次第）。
 *
 * 波形は長い解析器（WAVEFORM_BUFFER_SIZE）から、前回読んでから進んだ時間（AudioContext の currentTime）の分だけ
 * 取り出す。直近の一部だけを読むと読む間隔の間の音を取りこぼし、平均・最大がずれる
 */
import { FFT_SIZE, WAVEFORM_BUFFER_SIZE } from "../../../domain/limits";
import { type AudioInput, AudioInputError, type OpenAudioInput } from "../core/port";

type AudioContextConstructor = typeof AudioContext;

function audioContextClass(): AudioContextConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  // 古い Safari（14.1 より前）は接頭辞つきだけを持つ
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext
  );
}

function errorKind(error: unknown): AudioInputError["kind"] {
  const name = error instanceof Error || error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "permission";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "not-found";
  if (name === "NotReadableError" || name === "AbortError") return "in-use";
  return "unknown";
}

export const openMicrophone: OpenAudioInput = async () => {
  const AudioContextClass = audioContextClass();
  if (!navigator.mediaDevices?.getUserMedia || !AudioContextClass) {
    throw new AudioInputError("unsupported");
  }
  // AudioContext はボタンの操作の中（最初の await の前）で作って再開する。
  // 許可を待った後だと、Safari 等は操作の外とみなして止まったままにすることがある
  let context: AudioContext;
  try {
    context = new AudioContextClass();
  } catch (error) {
    throw new AudioInputError("unsupported", { cause: error });
  }
  const resume = () => {
    // 再開の Promise は環境によって返ってこないことがあるので待たない（再開できなければ無音として扱われ、
    // 「音を受け取れませんでした」と案内する）
    if (context.state === "suspended") void context.resume().catch(() => undefined);
  };
  resume();
  const closeContext = () => void context.close().catch(() => undefined);

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  } catch (error) {
    closeContext();
    throw new AudioInputError(errorKind(error), { cause: error });
  }

  const stopAll = () => {
    for (const track of stream.getTracks()) track.stop();
    closeContext();
  };
  try {
    resume();
    const analyser = context.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = 0;
    const waveform = context.createAnalyser();
    waveform.fftSize = WAVEFORM_BUFFER_SIZE;
    // スピーカーには繋がない（ハウリングしない）
    const source = context.createMediaStreamSource(stream);
    source.connect(analyser);
    source.connect(waveform);

    const samples = new Float32Array(waveform.fftSize);
    const spectrumDb = new Float32Array(analyser.frequencyBinCount);
    let lastTime = context.currentTime;
    let closed = false;
    const input: AudioInput = {
      read() {
        const now = context.currentTime;
        const count = Math.min(
          samples.length,
          Math.max(0, Math.round((now - lastTime) * context.sampleRate)),
        );
        lastTime = now;
        waveform.getFloatTimeDomainData(samples);
        analyser.getFloatFrequencyData(spectrumDb);
        return {
          samples: samples.subarray(samples.length - count),
          spectrumDb,
          sampleRate: context.sampleRate,
        };
      },
      processingActive() {
        const settings = stream.getAudioTracks()[0]?.getSettings();
        return Boolean(
          settings?.echoCancellation || settings?.noiseSuppression || settings?.autoGainControl,
        );
      },
      // マイクが外された・許可が取り消された等でトラックが終わると false
      isActive() {
        return !closed && stream.getAudioTracks().some((track) => track.readyState === "live");
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
