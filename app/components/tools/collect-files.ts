/**
 * 入力ファイルの収集：<input> の FileList とドロップ（フォルダを再帰的に辿る）を
 * 「ファイル＋相対パス」の配列にそろえる。
 */

export interface PickedFile {
  file: File;
  /** フォルダ由来の相対パス（"photos/a.png"）。単体なら file.name */
  path: string;
}

interface FileSystemEntryLike {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  fullPath: string;
}
interface FileSystemFileEntryLike extends FileSystemEntryLike {
  file(ok: (f: File) => void, err: (e: unknown) => void): void;
}
interface FileSystemDirectoryEntryLike extends FileSystemEntryLike {
  createReader(): {
    readEntries(ok: (e: FileSystemEntryLike[]) => void, err: (e: unknown) => void): void;
  };
}

/** <input type="file"> から（webkitdirectory なら相対パス付き） */
export function filesFromInput(list: FileList | File[] | null | undefined): PickedFile[] {
  if (!list) return [];
  return Array.from(list).map((file) => ({
    file,
    path: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
  }));
}

async function readAllEntries(dir: FileSystemDirectoryEntryLike): Promise<FileSystemEntryLike[]> {
  const reader = dir.createReader();
  const all: FileSystemEntryLike[] = [];
  // readEntries は 100 件ずつしか返さないので空になるまで呼ぶ
  for (;;) {
    const batch = await new Promise<FileSystemEntryLike[]>((ok, err) =>
      reader.readEntries(ok, err),
    );
    if (batch.length === 0) break;
    all.push(...batch);
  }
  return all;
}

async function walkEntry(entry: FileSystemEntryLike, out: PickedFile[]): Promise<void> {
  if (entry.isFile) {
    const file = await new Promise<File>((ok, err) =>
      (entry as FileSystemFileEntryLike).file(ok, err),
    );
    out.push({ file, path: entry.fullPath.replace(/^\/+/, "") || file.name });
    return;
  }
  if (entry.isDirectory) {
    for (const child of await readAllEntries(entry as FileSystemDirectoryEntryLike)) {
      await walkEntry(child, out);
    }
  }
}

/** ドロップされたもの（ファイル・フォルダ）から。フォルダは中身を辿る */
export async function filesFromDrop(dt: DataTransfer): Promise<PickedFile[]> {
  const out: PickedFile[] = [];
  const items = Array.from(dt.items ?? []);
  const entries = items
    .map((item) => {
      const getEntry = (
        item as DataTransferItem & {
          webkitGetAsEntry?: () => FileSystemEntryLike | null;
        }
      ).webkitGetAsEntry;
      return getEntry ? getEntry.call(item) : null;
    })
    .filter((e): e is FileSystemEntryLike => !!e);
  if (entries.length > 0) {
    for (const entry of entries) await walkEntry(entry, out);
    return out;
  }
  return filesFromInput(dt.files);
}
