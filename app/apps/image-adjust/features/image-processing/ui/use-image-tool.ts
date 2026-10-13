/**
 * 変換・圧縮ツールの React 側（状態の購読と操作の束ね）。処理の進行は adapters/engine.ts。
 * 項目と設定は ToolSessionProvider に置く（言語切り替えで失わない。AGENTS.md）。
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useToolSession, useToolSessionStore } from "~/platform/state/ToolSessionProvider";
import { formatFromExtension, type ImageFormat } from "../../../domain/format";
import type { RemoteImageErrorCode } from "../../../domain/remote-image";
import { formatBytes, useI18n } from "../../../i18n";
import { currentLimits } from "../../../shared/device";
import { subscribeIncomingFiles } from "../../../shared/incoming-files";
import type { PickedFile } from "../adapters/collect-files";
import {
  addItem,
  addPickedFiles,
  bindContext,
  type EngineContext,
  clearAll as engineClearAll,
  removeItem as engineRemoveItem,
  ITEMS_KEY,
  NOTICES_KEY,
  planZipParts,
  pump,
  pushNotice,
  saveZipPart,
  scheduleReprocess,
  syncWithSettings,
  ZIP_PARTS_KEY,
} from "../adapters/engine";
import type { ToolItem, ToolNotice, ZipPartPlan } from "../adapters/tool-types";
import { DEFAULT_SETTINGS, type ProcessSettings } from "../core/types";

/** URL 入力の窓口（実装は remote-image feature。ページで注入する） */
export interface RemoteImageLoader {
  /** 画像 URL を取得して File にする */
  load(url: string): Promise<File>;
  /** 取得の失敗の種類。分からない失敗（中断を含む）は undefined */
  errorCode(error: unknown): RemoteImageErrorCode | undefined;
}

export interface UseImageToolOptions {
  /** 設定のキー（ページごと。例 "tool:convert:png-to-webp"） */
  settingsKey: string;
  initialSettings?: Partial<ProcessSettings>;
  remoteImage: RemoteImageLoader;
}

export function useImageTool({ settingsKey, initialSettings, remoteImage }: UseImageToolOptions) {
  const { t, lang } = useI18n();
  const store = useToolSessionStore();
  const [items] = useToolSession<ToolItem[]>(ITEMS_KEY, []);
  const [notices, setNotices] = useToolSession<ToolNotice[]>(NOTICES_KEY, []);
  const [zipParts, setZipParts] = useToolSession<ZipPartPlan[]>(ZIP_PARTS_KEY, []);
  const [settings, setSettings] = useToolSession<ProcessSettings>(
    `${settingsKey}:settings`,
    () => ({ ...DEFAULT_SETTINGS, ...initialSettings }),
  );
  const [presetId, setPresetId] = useToolSession<string>(`${settingsKey}:preset`, "none");
  const [urlBusy, setUrlBusy] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const limits = useMemo(() => currentLimits(), []);

  const context = useMemo<EngineContext>(
    () => ({ store, limits, settings, formatBytes: (b) => formatBytes(lang, b) }),
    [store, limits, settings, lang],
  );
  // 処理の進行に必要な参照を最新に保つ
  bindContext(context);

  // マウント時：別のページの設定で作った結果があれば再処理する。以降の設定変更はまとめて再処理
  const [mountedSettings] = useState(settings);
  useEffect(() => {
    syncWithSettings(store, mountedSettings);
    pump();
  }, [store, mountedSettings]);
  useEffect(() => {
    if (settings !== mountedSettings) scheduleReprocess(store, settings);
  }, [settings, mountedSettings, store]);

  const addFiles = useCallback(
    (picked: PickedFile[]) => {
      setZipParts([]);
      return addPickedFiles(context, picked);
    },
    [context, setZipParts],
  );

  const addUrl = useCallback(
    async (url: string) => {
      setUrlBusy(true);
      setUrlError(null);
      try {
        const file = await remoteImage.load(url);
        setZipParts([]);
        addItem(context, { source: file, name: file.name, path: file.name, type: file.type });
      } catch (e) {
        const code = remoteImage.errorCode(e);
        if (code) {
          setUrlError(t(`tool.input.urlErrors.${code}`));
        } else if (!(e instanceof DOMException && e.name === "AbortError")) {
          setUrlError(t("tool.input.urlErrors.network"));
        }
      } finally {
        setUrlBusy(false);
      }
    },
    [context, t, setZipParts, remoteImage],
  );

  // PWA の共有受け取り・ファイルの関連付けから届いたファイル
  useEffect(() => {
    return subscribeIncomingFiles((files) => {
      void addFiles(files.map((file) => ({ file, path: file.name })));
    });
  }, [addFiles]);

  const removeItem = useCallback((id: string) => engineRemoveItem(store, id), [store]);
  const clearAll = useCallback(() => engineClearAll(store), [store]);
  const dismissNotice = useCallback(
    (id: string) => setNotices((prev) => prev.filter((n) => n.id !== id)),
    [setNotices],
  );
  const notify = useCallback(
    (code: ToolNotice["code"], detail?: string) => pushNotice(store, code, detail),
    [store],
  );

  const updateSettings = useCallback(
    (patch: Partial<ProcessSettings>) => setSettings((prev) => ({ ...prev, ...patch })),
    [setSettings],
  );

  /** 分割 ZIP の 1 本を保存する */
  const savePart = useCallback(
    async (part: ZipPartPlan) => {
      setSaving(true);
      try {
        await saveZipPart(store, part);
      } catch {
        // 通知は saveZipPart が出している
      } finally {
        setSaving(false);
      }
    },
    [store],
  );

  /** 一括保存：1 本に収まればすぐ保存、分割になるなら 1 本ずつの保存ボタンを出す */
  const saveAll = useCallback(async () => {
    const baseName = `image-adjust-${new Date().toISOString().slice(0, 10)}`;
    const parts = planZipParts(items, limits, baseName);
    if (parts.length === 0) return;
    if (parts.length === 1 && parts[0]) {
      setZipParts([]);
      await savePart(parts[0]);
      return;
    }
    setZipParts(parts);
  }, [items, limits, savePart, setZipParts]);

  const progress = useMemo(() => {
    const active = items.filter((it) => it.status !== "skipped");
    const done = active.filter((it) => it.status === "done" || it.status === "error").length;
    return {
      done,
      total: active.length,
      processing: active.some((it) => it.status === "processing" || it.status === "queued"),
    };
  }, [items]);

  const inputFormats = useMemo(() => {
    const set = new Set<ImageFormat>();
    for (const it of items) {
      const f = it.result?.inputFormat ?? formatFromExtension(it.name);
      if (f) set.add(f);
    }
    return set;
  }, [items]);

  /** 一括保存が何本の ZIP になるか（ボタンの表示用） */
  const zipPartCount = useMemo(() => planZipParts(items, limits, "x").length, [items, limits]);

  return {
    items,
    settings,
    updateSettings,
    presetId,
    setPresetId,
    addFiles,
    addUrl,
    urlBusy,
    urlError,
    removeItem,
    clearAll,
    notices,
    dismissNotice,
    notify,
    saveAll,
    savePart,
    saving,
    zipParts,
    zipPartCount,
    progress,
    limits,
    inputFormats,
  };
}

export type ImageToolState = ReturnType<typeof useImageTool>;
