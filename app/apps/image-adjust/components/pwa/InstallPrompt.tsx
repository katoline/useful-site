/**
 * インストール導線（フッターに置く。plan.md §6.1）。
 * - Android 等：beforeinstallprompt を受け取ったらボタンを出す
 * - iOS Safari：「共有 → ホーム画面に追加」の案内を出す
 * - すでにインストール済み（standalone で起動）なら何も出さない
 */
import { Download, Share } from "lucide-react";
import { useSyncExternalStore } from "react";
import { useI18n } from "~/apps/image-adjust/i18n";
import { Button } from "~/platform/ui/button";
import { promptInstall, usePwaState } from "./pwa-store";

type Platform = "standalone" | "ios" | "other";

function detectPlatform(): Platform {
  const nav = navigator as Navigator & { standalone?: boolean };
  if (nav.standalone || window.matchMedia?.("(display-mode: standalone)").matches) {
    return "standalone";
  }
  const ua = nav.userAgent;
  // iPadOS 13 以降は Mac として名乗るので、タッチ対応で見分ける
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1);
  return ios ? "ios" : "other";
}

const noopSubscribe = () => () => {};

export function InstallPrompt() {
  const { t } = useI18n();
  const { canInstall } = usePwaState();
  // プリレンダリング時は "standalone"（何も出さない）とみなし、ハイドレーション後に判定する
  const platform = useSyncExternalStore<Platform>(
    noopSubscribe,
    detectPlatform,
    () => "standalone",
  );

  if (platform === "standalone") return null;
  if (platform === "ios") {
    return (
      <p className="flex items-start gap-2" data-testid="pwa-ios-hint">
        <Share className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>{t("pwa.iosInstallHint")}</span>
      </p>
    );
  }
  if (!canInstall) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Button variant="outline" size="sm" className="h-11" onClick={() => void promptInstall()}>
        <Download aria-hidden />
        {t("pwa.install")}
      </Button>
      <span>{t("pwa.installHint")}</span>
    </div>
  );
}
