import type { AppIconKey } from "../types";
import { APP_ICON_COMPONENTS } from "./icon-components";

export function AppIcon({ icon, className }: { icon: AppIconKey; className?: string }) {
  const Icon = APP_ICON_COMPONENTS[icon];
  return <Icon aria-hidden className={className ?? "size-5"} />;
}
