/**
 * サービスのロゴ（Simple Icons v16・CC0）。木を揺らせるよう、使う 10 種だけを名前付きで import する。
 * パスはビルド時に定数へ畳まれ、外部への通信はしない。
 */
import {
  siDiscord,
  siFacebook,
  siGithub,
  siInstagram,
  siLine,
  siTelegram,
  siTiktok,
  siWhatsapp,
  siX,
  siYoutube,
} from "simple-icons";
import type { BrandIconId } from "../../../domain/icons";
import type { IconDefinition } from "../core/artwork";

const PATHS: Record<BrandIconId, string> = {
  github: siGithub.path,
  youtube: siYoutube.path,
  instagram: siInstagram.path,
  x: siX.path,
  line: siLine.path,
  discord: siDiscord.path,
  whatsapp: siWhatsapp.path,
  facebook: siFacebook.path,
  tiktok: siTiktok.path,
  telegram: siTelegram.path,
};

export function brandIconDefinition(id: BrandIconId): IconDefinition {
  return { render: "solid", shapes: [{ type: "path", d: PATHS[id] }] };
}
