import { FileText, Grid2X2, Image, Wrench } from "lucide-react";
import type { AppIconKey } from "../types";

const icons = { image: Image, "file-text": FileText, wrench: Wrench, grid: Grid2X2 };
export function AppIcon({ icon, className }: { icon: AppIconKey; className?: string }) {
  const Icon = icons[icon];
  return <Icon aria-hidden className={className ?? "size-5"} />;
}
