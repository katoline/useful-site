/**
 * QR コード中央に置くアイコンの用語・ID・上限値と、親（ページ）・生成エンジンと共有する型。
 * 何にも依存しない（DOM もライブラリも知らない）。描画用の図形データは features/icon-selection に置く。
 */

/** 汎用アイコン（Lucide 相当の固定パス）。ja.ts の icon.icons と同じ ID を並べる */
export const GENERIC_ICON_IDS = [
  "link",
  "globe",
  "heart",
  "star",
  "mail",
  "phone",
  "shopping-bag",
  "camera",
  "user",
  "map-pin",
] as const;
export type GenericIconId = (typeof GENERIC_ICON_IDS)[number];

/** サービスのロゴ（Simple Icons）。ja.ts の icon.icons と同じ ID を並べる */
export const BRAND_ICON_IDS = [
  "github",
  "youtube",
  "instagram",
  "x",
  "line",
  "discord",
  "whatsapp",
  "facebook",
  "tiktok",
  "telegram",
] as const;
export type BrandIconId = (typeof BRAND_ICON_IDS)[number];

/** 組込アイコンの ID（汎用とブランドの両方） */
export type IconId = GenericIconId | BrandIconId;
export const BUILTIN_ICON_IDS: readonly IconId[] = [...GENERIC_ICON_IDS, ...BRAND_ICON_IDS];

export function isBrandIconId(id: IconId): id is BrandIconId {
  return (BRAND_ICON_IDS as readonly string[]).includes(id);
}

/** アップロード画像の上限。ここを変えるときは ja.ts の hint も揃える */
export const MAX_ICON_SOURCE_BYTES = 2 * 1024 * 1024; // 2 MiB
export const MAX_ICON_SOURCE_DIMENSION = 4096; // 4096 x 4096
export const MAX_ICON_ARTWORK_DIMENSION = 512; // 埋め込む PNG の最大辺

/** 受け付ける画像の MIME。SVG・GIF と任意の外部 URL は受け付けない */
export const ICON_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export type IconImageMimeType = (typeof ICON_IMAGE_MIME_TYPES)[number];

/** 中央アイコンの選択。状態は親（useToolSession）が持ち、feature は値を渡されるだけ */
export type IconSelection =
  | { readonly kind: "none" }
  | { readonly kind: "builtin"; readonly id: IconId }
  | {
      readonly kind: "image";
      /** 512px 以下へ縮小し PNG へ再エンコード済みの data URL */
      readonly dataUrl: string;
      readonly width: number;
      readonly height: number;
    };

/** 生成エンジンへ渡す、QR に埋め込めるアイコンの絵。信頼済みの固定 SVG か、変換済み PNG */
export type IconArtwork =
  | { readonly kind: "svg"; readonly svg: string }
  | { readonly kind: "png"; readonly dataUrl: string };

/** 画像を選べなかった理由（画面の文言に対応する） */
export type IconImageErrorReason = "type" | "size" | "dimension" | "decode";

export function noIcon(): IconSelection {
  return { kind: "none" };
}

export function builtinIcon(id: IconId): IconSelection {
  return { kind: "builtin", id };
}

export function imageIcon(dataUrl: string, width: number, height: number): IconSelection {
  return { kind: "image", dataUrl, width, height };
}

/** 選択がアイコン ID を指すときだけその ID を返す */
export function selectionIconId(selection: IconSelection): IconId | undefined {
  return selection.kind === "builtin" ? selection.id : undefined;
}
