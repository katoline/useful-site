/** 音の入力の窓口（実装は adapters。マイク・Web Audio はそちらに閉じ込める） */

export interface AudioFrame {
  /** 直近の波形（-1〜1） */
  samples: Float32Array;
  /** 直近のスペクトル（ビンごとの dB。長さは FFT の点数の半分） */
  spectrumDb: Float32Array;
  sampleRate: number;
}

export interface AudioInput {
  /** その時点の波形とスペクトルを読む */
  read(): AudioFrame;
  /** 入力が続いているか（マイクが外された等で途中で終わると false） */
  isActive(): boolean;
  /** マイクを止めて後始末する（何度呼んでもよい） */
  close(): void;
}

export type AudioInputErrorKind = "permission" | "not-found" | "in-use" | "unsupported" | "unknown";

export class AudioInputError extends Error {
  constructor(
    readonly kind: AudioInputErrorKind,
    options?: { cause?: unknown },
  ) {
    super(`audio input: ${kind}`, options);
    this.name = "AudioInputError";
  }
}

/** 入力を開く（許可の確認はここで出る） */
export type OpenAudioInput = () => Promise<AudioInput>;
