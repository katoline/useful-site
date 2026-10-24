/** 音の入力の窓口（実装は adapters。マイク・Web Audio はそちらに閉じ込める） */

export interface AudioFrame {
  /** 前回読んでから届いた波形（-1〜1）。まだ届いていなければ空 */
  samples: Float32Array;
  /** 直近のスペクトル（ビンごとの dB。長さは FFT の点数の半分） */
  spectrumDb: Float32Array;
  sampleRate: number;
}

export interface AudioInput {
  /** 前回から届いた波形と、その時点のスペクトルを読む */
  read(): AudioFrame;
  /**
   * 端末の音の加工（エコー除去・雑音抑制・自動音量調整）が切れずに残っているか。
   * 残っていると値が正しく出ないので案内する（分からなければ false）
   */
  processingActive(): boolean;
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
