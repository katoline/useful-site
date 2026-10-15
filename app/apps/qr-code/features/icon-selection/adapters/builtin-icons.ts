/**
 * 組込アイコンの図形の取り出しと、選択から QR へ渡す絵（IconArtwork）への変換。
 * 親ページと生成エンジンは、この型の値を受け渡すだけで互いを import しない。
 */
import {
  type IconArtwork,
  type IconId,
  type IconSelection,
  isBrandIconId,
} from "../../../domain/icons";
import { type IconDefinition, iconSvgArtwork } from "../core/artwork";
import { brandIconDefinition } from "./brand-icons";
import { genericIconDefinition } from "./generic-icons";

/** 組込アイコン（汎用・ブランド）の図形。ユーザーの入力は含まない */
export function builtinIconDefinition(id: IconId): IconDefinition {
  return isBrandIconId(id) ? brandIconDefinition(id) : genericIconDefinition(id);
}

/** 選択を、QR に埋め込める絵へ変換する（アイコンなしのときは null） */
export function artworkForSelection(selection: IconSelection): IconArtwork | null {
  switch (selection.kind) {
    case "none":
      return null;
    case "builtin":
      return iconSvgArtwork(builtinIconDefinition(selection.id));
    case "image":
      return { kind: "png", dataUrl: selection.dataUrl };
  }
}
