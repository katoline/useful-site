/**
 * アプリのアイコン（manifest.icon）と lucide のアイコンの対応表。
 * 画面（icons.tsx）と OGP 画像の生成（scripts/generate-og-images.ts。Node から直接読む）で共有する。
 */
import {
  AudioLines,
  FileText,
  Gauge,
  Grid2X2,
  Image,
  type LucideIcon,
  QrCode,
  Wrench,
} from "lucide-react";
import type { AppIconKey } from "../types";

export const APP_ICON_COMPONENTS: Record<AppIconKey, LucideIcon> = {
  image: Image,
  "file-text": FileText,
  wrench: Wrench,
  grid: Grid2X2,
  "qr-code": QrCode,
  "audio-lines": AudioLines,
  gauge: Gauge,
};
