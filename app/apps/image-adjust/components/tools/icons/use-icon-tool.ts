/**
 * アイコン生成ツールの状態。すべて useToolSession に置く（言語切り替えで消えない §9.2）。
 */
import { useCallback, useEffect, useState } from "react";
import { generateIconFiles } from "~/apps/image-adjust/lib/icons/generate";
import { DEFAULT_ICON_SETTINGS, type IconSettings } from "~/apps/image-adjust/lib/icons/settings";
import type { IconSource } from "~/apps/image-adjust/lib/icons/source";
import type { IconFile } from "~/apps/image-adjust/lib/icons/zip";
import { useToolSession } from "~/platform/state/ToolSessionProvider";

export type PreviewBackground = "checker" | "white" | "black";

interface IconResult {
  source: IconSource;
  settings: IconSettings;
  files: IconFile[];
}

/** 設定を変えてから生成するまでの待ち時間（スライダーを動かしている間は作り直さない） */
const GENERATE_DELAY_MS = 150;

export function useIconTool() {
  const [source, setSourceState] = useToolSession<IconSource | null>("icons:source", null);
  const [settings, setSettings] = useToolSession<IconSettings>(
    "icons:settings",
    DEFAULT_ICON_SETTINGS,
  );
  const [result, setResult] = useToolSession<IconResult | null>("icons:result", null);
  const [previewBg, setPreviewBg] = useToolSession<PreviewBackground>(
    "icons:previewBackground",
    "checker",
  );
  const [failed, setFailed] = useState(false);

  const upToDate = Boolean(source && result?.source === source && result.settings === settings);

  useEffect(() => {
    if (!source || upToDate) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      generateIconFiles(source, settings).then(
        (files) => {
          if (cancelled) return;
          setFailed(false);
          setResult({ source, settings, files });
        },
        () => {
          if (!cancelled) setFailed(true);
        },
      );
    }, GENERATE_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [source, settings, upToDate, setResult]);

  const setSource = useCallback(
    (next: IconSource) => {
      setSourceState(next);
      setFailed(false);
    },
    [setSourceState],
  );

  const updateSettings = useCallback(
    (patch: Partial<IconSettings>) => setSettings((prev) => ({ ...prev, ...patch })),
    [setSettings],
  );

  return {
    source,
    setSource,
    settings,
    updateSettings,
    files: result && result.source === source ? result.files : null,
    upToDate,
    generating: Boolean(source) && !upToDate && !failed,
    failed,
    previewBg,
    setPreviewBg,
  };
}
