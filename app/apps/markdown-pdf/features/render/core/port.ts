/** Markdown を HTML にする窓口（実装は adapters。ライブラリはそちらに閉じ込める） */

export interface RenderOptions {
  /** 一緒に入れた画像：ファイル名（または相対パス）→ 表示に使う URL（blob:） */
  images: ReadonlyMap<string, string>;
  /** 表示しなかった画像の代わりに出す文言（外部 URL・見つからない画像） */
  blockedImageLabel: string;
}

export interface MarkdownRenderer {
  /**
   * Markdown を本文の HTML（body の中身）にする。生の HTML は文字として表示し、
   * 危険な URL はリンク・画像にしない
   */
  render(markdown: string, options: RenderOptions): string;
}

/** 実装を読み込む（重い依存は使う瞬間に読み込む） */
export type LoadRenderer = () => Promise<MarkdownRenderer>;
