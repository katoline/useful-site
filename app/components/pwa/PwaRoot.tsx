/**
 * PWA のページ側（root.tsx に 1 つ置く）。
 * - Service Worker の登録と「更新があります」の表示（registerType: prompt 相当）
 * - 共有受け取り（?share=1 で開かれたとき）とファイルの関連付け（launchQueue）のファイルを
 *   pushIncomingFiles() で変換画面に渡す
 */
import { RefreshCw, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Button } from "~/components/ui/button";
import { useI18n } from "~/i18n";
import { SHARE_QUERY_PARAM } from "~/lib/pwa";
import { pushIncomingFiles } from "~/state/incoming-files";
import { applyUpdate, dismissUpdate, registerServiceWorker, usePwaState } from "./pwa-store";
import { consumeLaunchQueue, takeSharedFiles } from "./shared-files";

/** 共有で開かれたページ 1 回につき 1 回だけ取り出す（同じ Promise を返す） */
let sharedTake: Promise<File[]> | null = null;
function takeSharedFilesOnce(): Promise<File[]> {
  sharedTake ??= takeSharedFiles();
  return sharedTake;
}

/** 受け取り件数の表示を消すまでの時間 */
const RECEIVED_NOTICE_MS = 6000;

export function PwaRoot() {
  const { t } = useI18n();
  const { updateWaiting, updatedElsewhere } = usePwaState();
  const showUpdate = updateWaiting || updatedElsewhere;
  const location = useLocation();
  const navigate = useNavigate();
  const [received, setReceived] = useState(0);

  useEffect(() => {
    registerServiceWorker();
    consumeLaunchQueue((files) => {
      pushIncomingFiles(files);
      setReceived(files.length);
    });
  }, []);

  const shared = new URLSearchParams(location.search).has(SHARE_QUERY_PARAM);
  useEffect(() => {
    if (!shared) return;
    // 取り出しはキャッシュを消すので 1 回きりにする。effect がやり直されても結果は捨てない
    // （捨てるとファイルが失われる）。pushIncomingFiles() はコンポーネントの外の受け渡し口
    void takeSharedFilesOnce().then((files) => {
      if (files.length > 0) {
        pushIncomingFiles(files);
        setReceived(files.length);
      }
      // 再読み込みで同じ処理をしないよう、?share=1 を URL から消す
      navigate(location.pathname, { replace: true, preventScrollReset: true });
    });
  }, [shared, location.pathname, navigate]);

  useEffect(() => {
    if (received === 0) return;
    const timer = window.setTimeout(() => setReceived(0), RECEIVED_NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [received]);

  if (!showUpdate && received === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      {received > 0 && (
        <p
          role="status"
          data-testid="pwa-received"
          className="pointer-events-auto rounded-md border border-border bg-card px-4 py-3 text-sm text-card-foreground shadow-lg"
        >
          {t("pwa.receivedFiles", { count: received })}
        </p>
      )}
      {showUpdate && (
        <div
          role="status"
          data-testid="pwa-update"
          className="pointer-events-auto flex items-center gap-2 rounded-md border border-border bg-card py-1 pr-1 pl-4 text-sm text-card-foreground shadow-lg"
        >
          <span>{t(updatedElsewhere ? "pwa.updatedElsewhere" : "pwa.updateAvailable")}</span>
          <Button size="sm" className="h-11" onClick={applyUpdate}>
            <RefreshCw aria-hidden />
            {t("pwa.reload")}
          </Button>
          <Button variant="ghost" size="icon" aria-label={t("pwa.dismiss")} onClick={dismissUpdate}>
            <X aria-hidden />
          </Button>
        </div>
      )}
    </div>
  );
}
