/**
 * icon-selection：QR コード中央のアイコンの選択（なし／汎用／ブランド／自分の画像）。
 * feature の外からはここだけを import する。ページが使う API に絞る。
 * 生成エンジンとは相互 import せず、domain/icons.ts の型で値を受け渡す。
 */

export type { IconSelection } from "../../domain/icons";
// 選択の値と型は domain に置く（親ページと生成エンジンが同じ型を参照できるように）
export { noIcon } from "../../domain/icons";
export { IconPicker } from "./ui/IconPicker";
export { useIconSelection } from "./ui/use-icon-selection";
