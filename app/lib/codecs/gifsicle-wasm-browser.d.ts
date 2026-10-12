/** gifsicle-wasm-browser は型定義を同梱していないので、使う範囲だけ宣言する */
declare module "gifsicle-wasm-browser" {
  interface GifsicleInput {
    file: string | Blob | File | ArrayBuffer;
    name: string;
  }
  interface GifsicleRunOptions {
    input: GifsicleInput[];
    command: string[];
    folder?: string[];
    isStrict?: boolean;
  }
  const gifsicle: {
    run(options: GifsicleRunOptions): Promise<File[] | null>;
  };
  export default gifsicle;
}
