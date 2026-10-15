/**
 * アップロード画像の受け入れ判定（純粋関数。File ではなく name・size・type と先頭バイトだけを見る）。
 * 上限は domain/icons.ts、実際のデコードは adapters が行う。
 */
import {
  ICON_IMAGE_MIME_TYPES,
  type IconImageMimeType,
  MAX_ICON_ARTWORK_DIMENSION,
  MAX_ICON_SOURCE_BYTES,
  MAX_ICON_SOURCE_DIMENSION,
} from "../../../domain/icons";

export interface IconFileMeta {
  readonly name: string;
  readonly size: number;
  readonly type: string;
}

export type IconFileRejectReason = "type" | "size";
export type IconFileCheck =
  | { readonly ok: true; readonly type: IconImageMimeType }
  | { readonly ok: false; readonly reason: IconFileRejectReason };

const EXTENSION_TYPES: Record<string, IconImageMimeType> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot <= 0 ? "" : name.slice(dot).toLowerCase();
}

/** 宣言された MIME か、MIME が空のときだけ拡張子から受け付ける形式を決める */
export function iconImageType(
  file: Pick<IconFileMeta, "name" | "type">,
): IconImageMimeType | undefined {
  const declared = file.type.trim().toLowerCase();
  if ((ICON_IMAGE_MIME_TYPES as readonly string[]).includes(declared))
    return declared as IconImageMimeType;
  // 一部の環境は image/jpg を返す
  if (declared === "image/jpg") return "image/jpeg";
  if (!declared) return EXTENSION_TYPES[extensionOf(file.name)];
  return undefined;
}

/** 宣言された種類と大きさの検査。実際に読めるかはデコード（adapters）で確かめる */
export function checkIconFile(file: IconFileMeta): IconFileCheck {
  const type = iconImageType(file);
  if (!type) return { ok: false, reason: "type" };
  if (file.size > MAX_ICON_SOURCE_BYTES) return { ok: false, reason: "size" };
  return { ok: true, type };
}

/**
 * 先頭バイトから実際の形式を判定する（PNG・JPEG・WebP 以外は拒否）。
 * 拡張子や MIME を偽った SVG・GIF を弾くために、デコードの前にも確かめる。
 */
export function sniffIconImageType(bytes: Uint8Array): IconImageMimeType | undefined {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  )
    return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  )
    return "image/webp";
  return undefined;
}

/** デコード後の寸法が上限内か（0 や負の値も弾く） */
export function isWithinSourceDimensions(width: number, height: number): boolean {
  return (
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    width > 0 &&
    height > 0 &&
    width <= MAX_ICON_SOURCE_DIMENSION &&
    height <= MAX_ICON_SOURCE_DIMENSION
  );
}

/** 最大辺が max 以下になるよう、縦横比を保って縮小する（拡大はしない） */
export function fitWithinLimit(
  width: number,
  height: number,
  max: number = MAX_ICON_ARTWORK_DIMENSION,
): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
