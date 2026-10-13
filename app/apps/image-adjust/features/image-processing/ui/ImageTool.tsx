/**
 * 変換・圧縮ツール本体（トップ・/convert/:pair・/compress/:format で共用）。
 *
 * レイアウト（§6.2・§7.2）
 * - スマホ：入力 → 結果カード（縦並び）→ 広告。設定は下から出るシート、画面下に固定の操作バー
 * - PC：左に入力・設定カード・結果・広告（レスポンシブ 1 枠）、右サイドバーに縦長の広告 1 枠だけ
 *   （広告はドロップエリア・ダウンロードボタン・設定パネルの近くに置かない。
 *    結果が無いときは結果リストの下に出すとドロップエリア・設定パネルに近づくので、FAQ の後ろに出す）
 */
import { Check, FileArchive, LoaderCircle, Settings2, Trash } from "lucide-react";
import { useState } from "react";
import { AdSlot } from "~/platform/ads/AdSlot";
import { Button } from "~/platform/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/platform/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "~/platform/ui/sheet";
import { formatBytes, useI18n } from "../../../i18n";
import type { ProcessSettings } from "../core/types";
import { FileInput } from "./FileInput";
import { useWakeLock } from "./hooks";
import { ResultList } from "./ResultList";
import { SettingsPanel } from "./SettingsPanel";
import { type FaqItem, ToolFaq } from "./ToolFaq";
import { type ImageToolState, type RemoteImageLoader, useImageTool } from "./use-image-tool";

export interface ImageToolProps {
  /** 設定のキー（ページごと。例 "tool:convert:png-to-webp"） */
  settingsKey: string;
  initialSettings?: Partial<ProcessSettings>;
  /** ページ固有の説明（FAQ の上） */
  intro?: string;
  faq: FaqItem[];
  /** URL 入力の実装（remote-image feature。ページで注入する） */
  remoteImage: RemoteImageLoader;
}

export function ImageTool({
  settingsKey,
  initialSettings,
  intro,
  faq,
  remoteImage,
}: ImageToolProps) {
  const { t, lang } = useI18n();
  const state = useImageTool({ settingsKey, initialSettings, remoteImage });
  const [sheetOpen, setSheetOpen] = useState(false);
  useWakeLock(state.progress.processing);

  const hasItems = state.items.length > 0;
  const hasResults = state.items.some((it) => it.status === "done");
  const settingsPanel = (
    <SettingsPanel
      settings={state.settings}
      onChange={state.updateSettings}
      inputFormats={state.inputFormats}
      presetId={state.presetId}
      onPresetChange={state.setPresetId}
    />
  );
  const saveAllLabel =
    state.zipPartCount > 1
      ? t("tool.results.saveAllParts", { n: state.zipPartCount })
      : t("tool.results.saveAll");
  const saveAllButton = (testId: string, className?: string) => (
    <Button
      className={className}
      onClick={() => void state.saveAll()}
      disabled={!hasResults || state.saving}
      data-testid={testId}
    >
      {state.saving ? (
        <LoaderCircle className="animate-spin" aria-hidden />
      ) : (
        <FileArchive aria-hidden />
      )}
      {state.saving ? t("tool.results.saving") : saveAllLabel}
    </Button>
  );

  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-6">
        <FileInput
          onFiles={(files) => void state.addFiles(files)}
          onUrl={state.addUrl}
          urlBusy={state.urlBusy}
          urlError={state.urlError}
        />
        <p className="text-xs text-muted-foreground" data-testid="device-limits">
          {t("tool.device.limitNote", {
            pixels: Math.round(state.limits.maxPixels / 1_000_000),
            file: formatBytes(lang, state.limits.maxFileBytes),
          })}
        </p>

        {/* PC：設定カード */}
        <Card className="hidden md:block">
          <CardHeader>
            <CardTitle>{t("tool.settings.title")}</CardTitle>
          </CardHeader>
          <CardContent>{settingsPanel}</CardContent>
        </Card>

        {/* 結果の操作（PC） */}
        {hasItems && (
          <div className="hidden flex-wrap items-center gap-2 md:flex">
            {saveAllButton("save-all")}
            <Button variant="outline" onClick={state.clearAll} data-testid="clear-all">
              <Trash aria-hidden />
              {t("tool.results.clearAll")}
            </Button>
          </div>
        )}

        <ZipPartButtons state={state} />

        <ResultList state={state} />

        {/* 結果リストの下：レスポンシブ 1 枠（PC・スマホ共通。§7.2）。結果が無いときは FAQ の後ろ */}
        {hasItems && <AdSlot format="responsive" />}

        <ToolFaq intro={intro} faq={faq} />

        {!hasItems && <AdSlot format="responsive" />}
      </div>

      {/* PC の右サイドバー：縦長 1 枠（スクロール追従）。設定パネルは左列に置いて離す */}
      <aside className="hidden md:block">
        <div className="sticky top-20">
          <AdSlot format="sidebar" />
        </div>
      </aside>

      {/* スマホ：画面下の操作バー（親指の届く位置）＋ 設定シート */}
      <div
        data-mobile-action-bar
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden"
      >
        <div className="mx-auto flex max-w-6xl gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setSheetOpen(true)}
            data-testid="open-settings"
          >
            <Settings2 aria-hidden />
            {t("tool.settings.title")}
          </Button>
          {saveAllButton("save-all-mobile", "flex-1")}
        </div>
      </div>
      {/* 固定バーの分だけ下に余白を取る */}
      <div className="h-20 md:hidden" aria-hidden />

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" closeLabel={t("common.close")} data-testid="settings-sheet">
          <SheetHeader>
            <SheetTitle>{t("tool.settings.title")}</SheetTitle>
          </SheetHeader>
          {settingsPanel}
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => setSheetOpen(false)}>
              {t("tool.settings.done")}
            </Button>
            {hasItems && (
              <Button variant="outline" onClick={state.clearAll}>
                <Trash aria-hidden />
                {t("tool.results.clearAll")}
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/** 分割 ZIP：1 本ずつ保存ボタンを出す（ブラウザは複数の自動ダウンロードを止めるため） */
function ZipPartButtons({ state }: { state: ImageToolState }) {
  const { t, lang } = useI18n();
  if (state.zipParts.length < 2) return null;
  return (
    <section
      aria-label={t("tool.results.saveAll")}
      className="flex flex-col gap-2 rounded-md border border-border p-3"
      data-testid="zip-parts"
    >
      <p className="text-sm text-muted-foreground">
        {t("tool.results.partsNote", { n: state.zipParts.length })}
      </p>
      <div className="flex flex-wrap gap-2">
        {state.zipParts.map((part) => (
          <Button
            key={part.index}
            variant={part.saved ? "outline" : "default"}
            onClick={() => void state.savePart(part)}
            disabled={state.saving}
            data-testid="zip-part"
          >
            {part.saved ? <Check aria-hidden /> : <FileArchive aria-hidden />}
            {t("tool.results.savePart", { n: part.index + 1, total: state.zipParts.length })}
            <span className="text-xs opacity-70 tabular-nums">
              {formatBytes(lang, part.bytes)}
              {part.saved ? ` · ${t("tool.results.partSaved")}` : ""}
            </span>
          </Button>
        ))}
      </div>
    </section>
  );
}
