/**
 * 生成したファイルを ZIP にまとめる（fflate）。
 */
import { zipSync } from "fflate";

export interface IconFile {
  name: string;
  data: Uint8Array;
  type: string;
}

export function buildIconZip(files: readonly IconFile[]): Uint8Array {
  const entries: Record<string, [Uint8Array, { level: 0 | 6 }]> = {};
  for (const file of files) {
    // PNG は圧縮済みなので格納だけにする
    entries[file.name] = [file.data, { level: file.type === "image/png" ? 0 : 6 }];
  }
  return zipSync(entries);
}
