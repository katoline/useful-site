/**
 * Web 用アイコン生成ツール（plan.md §2.4）。
 * 元画像の入力 → 余白・背景・角丸の調整 → プレビュー → ZIP 保存＋ HTML スニペット。
 * 生成ロジックは app/apps/image-adjust/features/icon-generator/ にあり、ここは UI だけ。
 *
 * レイアウト（§6.2・§7.2。変換ツール ImageTool と同じ構成）
 * - スマホ：入力 → プレビュー → 保存（HTML）→ 広告。設定は下から出るシート、画面下に「調整」「ZIP で保存」の固定バー
 * - PC：左に入力・設定・プレビュー・保存・広告（レスポンシブ 1 枠）、右サイドバーに縦長の広告 1 枠だけ
 *   （広告はドロップエリア・ダウンロードボタン・設定パネルの近くに置かない）
 */
import { Download, Settings2 } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { AdSlot } from "~/platform/ads/AdSlot";
import { Button } from "~/platform/ui/button";
import { Card, CardContent, CardHeader } from "~/platform/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "~/platform/ui/sheet";
import { useI18n } from "../../../i18n";
import { buildHeadSnippet, isAbsoluteUrl } from "../core/snippet";
import { downloadIconZip, IconOutput } from "./IconOutput";
import { IconPreview } from "./IconPreview";
import { IconSettingsPanel } from "./IconSettingsPanel";
import { SourceInput } from "./SourceInput";
import { useFileUrls } from "./use-file-urls";
import { useIconTool } from "./use-icon-tool";

const cardTitle = "text-lg leading-tight font-semibold";

export function IconTool({ children }: { children?: ReactNode }) {
  const { t } = useI18n();
  const tool = useIconTool();
  const urls = useFileUrls(tool.files);
  const [sheetOpen, setSheetOpen] = useState(false);
  const hasSvg = Boolean(tool.source?.isSvg);
  const canSave = Boolean(tool.files) && tool.upToDate;

  const snippet = useMemo(
    () => buildHeadSnippet(tool.settings, { hasSvg }),
    [tool.settings, hasSvg],
  );
  const notes = [
    ...(tool.settings.includeOg && !isAbsoluteUrl(tool.settings.basePath)
      ? [t("icons.output.ogNote")]
      : []),
  ];
  const settingsPanel = (
    <IconSettingsPanel settings={tool.settings} onChange={tool.updateSettings} />
  );

  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_320px]" data-testid="icon-tool">
      <div className="flex min-w-0 flex-col gap-6">
        <SourceInput source={tool.source} onSource={tool.setSource} />
        {tool.failed && (
          <p role="alert" className="text-sm text-destructive">
            {t("icons.errors.generate")}
          </p>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          {/* PC：設定カード（スマホはシート） */}
          <Card className="hidden md:block">
            <CardHeader>
              <h2 className={cardTitle}>{t("icons.settings.title")}</h2>
            </CardHeader>
            <CardContent>{settingsPanel}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <h2 className={cardTitle}>{t("icons.preview.title")}</h2>
            </CardHeader>
            <CardContent>
              <IconPreview
                urls={urls}
                name={tool.settings.name}
                background={tool.previewBg}
                onBackgroundChange={tool.setPreviewBg}
                generating={tool.generating}
              />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <h2 className={cardTitle}>{t("icons.output.title")}</h2>
          </CardHeader>
          <CardContent>
            <IconOutput files={tool.files} ready={tool.upToDate} snippet={snippet} notes={notes} />
          </CardContent>
        </Card>

        {/* 結果の下：レスポンシブ 1 枠（PC・スマホ共通。§7.2）。保存ボタンとの間に HTML スニペットを挟む */}
        <div className="mt-6">
          <AdSlot format="responsive" />
        </div>

        {children}
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
            data-testid="icons-open-settings"
          >
            <Settings2 aria-hidden />
            {t("icons.settings.title")}
          </Button>
          <Button
            className="flex-1"
            disabled={!canSave}
            onClick={() => tool.files && downloadIconZip(tool.files)}
            data-testid="icons-download-zip-mobile"
          >
            <Download aria-hidden />
            {t("icons.output.download")}
          </Button>
        </div>
      </div>
      {/* 固定バーの分だけ下に余白を取る */}
      <div className="h-20 md:hidden" aria-hidden />

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="bottom"
          closeLabel={t("common.close")}
          data-testid="icons-settings-sheet"
        >
          <SheetHeader>
            <SheetTitle>{t("icons.settings.title")}</SheetTitle>
          </SheetHeader>
          {settingsPanel}
          <Button onClick={() => setSheetOpen(false)}>{t("common.close")}</Button>
        </SheetContent>
      </Sheet>
    </div>
  );
}
