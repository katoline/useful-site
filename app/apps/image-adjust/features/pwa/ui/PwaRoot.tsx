/**
 * PWA のページ側（root.tsx に 1 つ置く）。
 * - Service Worker の登録と「更新があります」の表示（registerType: prompt 相当）
 * - 共有受け取り（?share=1 で開かれたとき）とファイルの関連付け（launchQueue）のファイルを
 *   pushIncomingFiles() で変換画面に渡す
 */
import { RefreshCw, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { BottomNotice } from "~/platform/shell/BottomNotices";
import { Button } from "~/platform/ui/button";
import { useI18n } from "../../../i18n";
import { pushIncomingFiles } from "../../../shared/incoming-files";
import { SHARE_QUERY_PARAM } from "../../../shared/pwa";
import {
  applyUpdate,
  dismissUpdate,
  registerServiceWorker,
  usePwaState,
} from "../adapters/pwa-store";
import { consumeLaunchQueue, takeSharedFiles } from "../adapters/shared-files";

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
    // 画面下の通知のコンテナ（BottomNotices）に、言語の案内と縦に積んで出す（重ならない）
    <BottomNotice>
      {received > 0 && (
        <div
          role="status"
          data-testid="pwa-received"
          className="pointer-events-auto flex items-center gap-2 rounded-md border border-border bg-card py-1 pr-1 pl-4 text-sm text-card-foreground shadow-lg"
        >
          <span className="flex-1">{t("pwa.receivedFiles", { count: received })}</span>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("pwa.dismiss")}
            onClick={() => setReceived(0)}
            data-testid="pwa-received-dismiss"
          >
            <X aria-hidden />
          </Button>
        </div>
      )}
      {showUpdate && (
        <div
          role="status"
          data-testid="pwa-update"
          className="pointer-events-auto flex items-center gap-2 rounded-md border border-border bg-card py-1 pr-1 pl-4 text-sm text-card-foreground shadow-lg"
        >
          <span className="flex-1">
            {t(updatedElsewhere ? "pwa.updatedElsewhere" : "pwa.updateAvailable")}
          </span>
          <Button size="sm" className="h-11" onClick={applyUpdate}>
            <RefreshCw aria-hidden />
            {t("pwa.reload")}
          </Button>
          <Button variant="ghost" size="icon" aria-label={t("pwa.dismiss")} onClick={dismissUpdate}>
            <X aria-hidden />
          </Button>
        </div>
      )}
    </BottomNotice>
  );
}
