/**
 * ZIP のストリーム作成（fflate の Zip）。§2.3・§5
 * - 画像は既に圧縮されているので無圧縮（store）で入れる。SVG だけ deflate する
 * - 出力先（sink）はディスク（File System Access API）か Blob。Blob のときは上限を超えそうなら分割する
 */
import { Zip, ZipDeflate, ZipPassThrough } from "fflate";

/**
 * fflate は ZIP64 を書けないので、1 本の ZIP は 4GiB 未満・65535 件未満に収める（安全側に余裕を取る）。
 * SplitZipWriter と File System Access 経路の分割判断に使う。
 */
export const ZIP32_MAX_BYTES = 4 * 1024 * 1024 * 1024 - 64 * 1024 * 1024;
export const ZIP32_MAX_ENTRIES = 65000;

export interface ZipSink {
  write(chunk: Uint8Array): Promise<void> | void;
  close(): Promise<void> | void;
  /** 失敗したときに書きかけを捨てる（対応する sink だけ） */
  abort?(): Promise<void> | void;
}

export interface ZipEntryInput {
  path: string;
  bytes: ArrayBuffer | Uint8Array;
  /** true なら deflate で圧縮する（テキスト系） */
  compress?: boolean;
}

/** 1 本の ZIP をストリームで書く */
export class ZipWriter {
  private readonly zip: Zip;
  private writing: Promise<void> = Promise.resolve();
  private failure: Error | null = null;
  private readonly usedPaths = new Set<string>();
  /** 書き込んだ（非圧縮の）バイト数の合計 */
  bytesWritten = 0;
  /** 追加した件数 */
  entries = 0;

  constructor(sink: ZipSink) {
    this.zip = new Zip((err, chunk, final) => {
      if (err) {
        this.failure = err;
        return;
      }
      this.writing = this.writing.then(() => sink.write(chunk));
      if (final) this.writing = this.writing.then(() => sink.close());
    });
  }

  /** 同じパスがあれば "name (2).ext" のように連番を付ける */
  uniquePath(path: string): string {
    if (!this.usedPaths.has(path)) {
      this.usedPaths.add(path);
      return path;
    }
    const dot = path.lastIndexOf(".");
    const slash = path.lastIndexOf("/");
    const hasExt = dot > slash + 1;
    const stem = hasExt ? path.slice(0, dot) : path;
    const ext = hasExt ? path.slice(dot) : "";
    for (let i = 2; ; i++) {
      const candidate = `${stem} (${i})${ext}`;
      if (!this.usedPaths.has(candidate)) {
        this.usedPaths.add(candidate);
        return candidate;
      }
    }
  }

  async add(entry: ZipEntryInput): Promise<void> {
    if (this.failure) throw this.failure;
    const data = entry.bytes instanceof Uint8Array ? entry.bytes : new Uint8Array(entry.bytes);
    const path = this.uniquePath(entry.path);
    const file = entry.compress ? new ZipDeflate(path, { level: 6 }) : new ZipPassThrough(path);
    this.zip.add(file);
    file.push(data, true);
    this.bytesWritten += data.byteLength;
    this.entries++;
    await this.writing;
    if (this.failure) throw this.failure;
  }

  async finish(): Promise<void> {
    this.zip.end();
    await this.writing;
    if (this.failure) throw this.failure;
  }
}

/** Blob にまとめる sink */
export class BlobSink implements ZipSink {
  private chunks: Uint8Array[] = [];
  private blob: Blob | null = null;
  write(chunk: Uint8Array): void {
    this.chunks.push(chunk);
  }
  close(): void {
    this.blob = new Blob(this.chunks as BlobPart[], { type: "application/zip" });
    this.chunks = [];
  }
  result(): Blob {
    if (!this.blob) throw new Error("ZIP はまだ閉じられていません");
    return this.blob;
  }
}

/** FileSystemWritableFileStream（File System Access API）へ書く sink */
export class WritableStreamSink implements ZipSink {
  private readonly writer: WritableStreamDefaultWriter<Uint8Array>;
  constructor(writable: WritableStream<Uint8Array>) {
    this.writer = writable.getWriter();
  }
  write(chunk: Uint8Array): Promise<void> {
    return this.writer.write(chunk);
  }
  async close(): Promise<void> {
    await this.writer.close();
  }
  async abort(): Promise<void> {
    await this.writer.abort().catch(() => {});
  }
}

/**
 * Blob 出力で上限を超えそうなら ZIP を分ける（§5）。
 * add() を呼ぶと、必要に応じて現在の ZIP を閉じて次の ZIP を始める。
 */
export class SplitZipWriter {
  private current: { writer: ZipWriter; sink: BlobSink } | null = null;
  readonly parts: Blob[] = [];

  private readonly maxBytesPerZip: number;

  constructor(maxBytesPerZip: number) {
    this.maxBytesPerZip = Math.min(maxBytesPerZip, ZIP32_MAX_BYTES);
  }

  async add(entry: ZipEntryInput): Promise<void> {
    const size = entry.bytes.byteLength;
    if (
      this.current &&
      (this.current.writer.bytesWritten + size > this.maxBytesPerZip ||
        this.current.writer.entries >= ZIP32_MAX_ENTRIES)
    ) {
      await this.closeCurrent();
    }
    if (!this.current) {
      const sink = new BlobSink();
      this.current = { writer: new ZipWriter(sink), sink };
    }
    await this.current.writer.add(entry);
  }

  private async closeCurrent(): Promise<void> {
    if (!this.current) return;
    await this.current.writer.finish();
    this.parts.push(this.current.sink.result());
    this.current = null;
  }

  async finish(): Promise<Blob[]> {
    await this.closeCurrent();
    return this.parts;
  }
}
