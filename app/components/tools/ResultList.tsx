/**
 * 結果リスト（§2.2・§6.2）。スマホでは縦並びのカード、PC でも同じカードを 1 列で並べる。
 * サムネイルは usePreviewUrl で縮小した PNG（SVG はラスタライズ済み）にする。
 */
import { CodeXml, Columns2, Download, LoaderCircle, Share2, Trash, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";
import { formatBytes, formatNumber, useI18n } from "~/i18n";
import { canShareFiles, downloadBlob, shareFiles } from "~/lib/archive/download";
import { formatFromExtension } from "~/lib/codecs/format";
import { reductionPercent } from "~/lib/pipeline/naming";
import { CompareDialog } from "./CompareDialog";
import { usePreviewUrl } from "./hooks";
import { THUMBNAIL_MAX_EDGE } from "./preview";
import { SnippetDialog } from "./SnippetDialog";
import { OUTPUT_BYTES, type ToolItem, type ToolNotice, type ToolOutput } from "./types";
import type { ImageToolState } from "./use-image-tool";

export function ResultList({ state }: { state: ImageToolState }) {
  const { t, lang } = useI18n();
  const { items, notices, dismissNotice, progress, removeItem, limits, notify } = state;

  const doneItems = items.filter((it) => it.status === "done" && it.result);
  const before = doneItems.reduce((s, it) => s + it.size, 0);
  const after = doneItems.reduce((s, it) => s + OUTPUT_BYTES(it), 0);

  return (
    <section aria-label={t("tool.results.title")} className="flex flex-col gap-4">
      {notices.map((n) => (
        <div
          key={n.id}
          role="alert"
          className="flex items-start justify-between gap-2 rounded-md border border-warning/40 p-3 text-sm"
          data-testid="tool-notice"
        >
          <span>{noticeText(t, n)}</span>
          <Button
            variant="ghost"
            size="icon"
            className="-m-2 size-9 shrink-0"
            aria-label={t("common.close")}
            onClick={() => dismissNotice(n.id)}
          >
            <X aria-hidden />
          </Button>
        </div>
      ))}

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="results-empty">
          {t("tool.results.empty")}
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="tabular-nums" data-testid="results-progress">
                {t("tool.results.progress", { done: progress.done, total: progress.total })}
              </span>
              {doneItems.length > 0 && (
                <span className="tabular-nums text-muted-foreground" data-testid="results-summary">
                  {t("tool.results.summary", {
                    count: doneItems.length,
                    before: formatBytes(lang, before),
                    after: formatBytes(lang, after),
                  })}{" "}
                  <ReductionBadge before={before} after={after} />
                </span>
              )}
            </div>
            {progress.processing && progress.total > 0 && (
              <Progress value={Math.round((progress.done / progress.total) * 100)} />
            )}
          </div>
          <ul className="flex flex-col gap-3" data-testid="result-list">
            {items.map((item) => (
              <li key={item.id}>
                <ResultCard
                  item={item}
                  onRemove={() => removeItem(item.id)}
                  onShareFailed={() => notify("share_failed")}
                  fileLimit={formatBytes(lang, limits.maxFileBytes)}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

type T = ReturnType<typeof useI18n>["t"];

function noticeText(t: T, n: ToolNotice): string {
  const withLimit = n.code === "file_too_large" || n.code === "zip_too_large";
  const text = t(`tool.results.errors.${n.code}`, { limit: n.detail ?? "" });
  return !withLimit && n.detail ? `${text} (${n.detail})` : text;
}

function ReductionBadge({ before, after }: { before: number; after: number }) {
  const { t, lang } = useI18n();
  const pct = reductionPercent(before, after);
  if (pct === 0) return <Badge variant="outline">{t("tool.results.unchanged")}</Badge>;
  const value = formatNumber(lang, Math.abs(pct), { maximumFractionDigits: 1 });
  return pct > 0 ? (
    <Badge variant="success" data-testid="reduction">
      {t("tool.results.reduction", { percent: value })}
    </Badge>
  ) : (
    <Badge variant="warning" data-testid="reduction">
      {t("tool.results.increase", { percent: value })}
    </Badge>
  );
}

function ResultCard({
  item,
  onRemove,
  onShareFailed,
  fileLimit,
}: {
  item: ToolItem;
  onRemove: () => void;
  onShareFailed: () => void;
  fileLimit: string;
}) {
  const { t, lang } = useI18n();
  const [compareOpen, setCompareOpen] = useState(false);
  const [snippetOpen, setSnippetOpen] = useState(false);
  const result = item.result;
  const first = result?.outputs[0];
  // サムネイルは出力（無ければ元データ）。ZIP 由来で元データを解放済みなら出力ができるまで出さない
  const previewBlob = first?.blob ?? item.source;
  const previewFormat = first?.format ?? result?.inputFormat ?? formatFromExtension(item.name);
  const previewUrl = usePreviewUrl(previewBlob, previewFormat, THUMBNAIL_MAX_EDGE);
  const hasVariants = !!result && result.outputs.some((o) => o.variantWidth);
  const canCompare = !!first;
  const outputBytes = OUTPUT_BYTES(item);

  return (
    <article
      className="flex gap-3 rounded-lg border border-border bg-card p-3"
      data-testid="result-card"
      data-status={item.status}
    >
      <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-checker sm:size-24">
        {previewUrl ? (
          <img src={previewUrl} alt="" className="size-full object-contain" draggable={false} />
        ) : (
          <LoaderCircle className="size-5 animate-spin text-muted-foreground" aria-hidden />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-medium" title={item.path} data-testid="result-name">
              {item.path}
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {formatBytes(lang, item.size)}
              {result?.inputWidth && result.inputHeight
                ? ` · ${result.inputWidth}×${result.inputHeight}`
                : ""}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="-mt-1 -mr-1 shrink-0"
            aria-label={t("tool.results.remove")}
            onClick={onRemove}
            data-testid="result-remove"
          >
            <Trash aria-hidden />
          </Button>
        </div>

        {item.status === "queued" && (
          <Badge variant="outline">{t("tool.results.status.queued")}</Badge>
        )}
        {item.status === "processing" && (
          <Badge variant="outline">
            <LoaderCircle className="size-3 animate-spin" aria-hidden />
            {t("tool.results.status.processing")}
          </Badge>
        )}
        {(item.status === "error" || item.status === "skipped") && item.error && (
          <p className="text-sm text-destructive" role="alert" data-testid="result-error">
            {t(`tool.results.errors.${item.error}`, { limit: fileLimit })}
          </p>
        )}

        {item.status === "done" && result && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm tabular-nums">
              <span data-testid="result-after">
                {formatBytes(lang, item.size)} → <strong>{formatBytes(lang, outputBytes)}</strong>
              </span>
              <ReductionBadge before={item.size} after={outputBytes} />
              {first?.quality != null && !hasVariants && (
                <span className="text-xs text-muted-foreground">
                  {t("tool.results.quality", { quality: first.quality })}
                </span>
              )}
            </div>
            {result.warnings.length > 0 && (
              <ul
                className="flex flex-col gap-1 text-xs text-warning"
                data-testid="result-warnings"
              >
                {result.warnings.map((w) => (
                  <li key={w}>{t(`tool.results.warnings.${w}`)}</li>
                ))}
              </ul>
            )}

            <div className="flex flex-wrap gap-2">
              {result.outputs.map((o) => (
                <div key={o.path} className="flex items-center gap-1">
                  <Button
                    variant={result.outputs.length === 1 ? "default" : "outline"}
                    size="sm"
                    className="h-11"
                    onClick={() => downloadBlob(o.blob, o.name)}
                    data-testid="result-save"
                  >
                    <Download aria-hidden />
                    {o.variantWidth
                      ? `${t("tool.results.save")} ${t("tool.results.variant", { width: o.variantWidth })}`
                      : t("tool.results.save")}
                  </Button>
                  <ShareButton output={o} onFailed={onShareFailed} />
                </div>
              ))}
              {canCompare && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11"
                  onClick={() => setCompareOpen(true)}
                  data-testid="result-compare"
                >
                  <Columns2 aria-hidden />
                  {t("tool.results.compare")}
                </Button>
              )}
              {hasVariants && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11"
                  onClick={() => setSnippetOpen(true)}
                  data-testid="result-snippet"
                >
                  <CodeXml aria-hidden />
                  {t("tool.results.snippet")}
                </Button>
              )}
            </div>
            {canCompare && first && (
              <CompareDialog
                item={item}
                outputs={result.outputs}
                open={compareOpen}
                onOpenChange={setCompareOpen}
              />
            )}
            {hasVariants && (
              <SnippetDialog item={item} open={snippetOpen} onOpenChange={setSnippetOpen} />
            )}
          </>
        )}
      </div>
    </article>
  );
}

/** Web Share API でこのファイルを共有できる端末（主にスマホ）でだけ出す */
function ShareButton({ output, onFailed }: { output: ToolOutput; onFailed: () => void }) {
  const { t } = useI18n();
  const file = useMemo(
    () => new File([output.blob], output.name, { type: output.blob.type }),
    [output],
  );
  const supported = useMemo(() => canShareFiles([file]), [file]);
  if (!supported) return null;
  const share = async () => {
    try {
      await shareFiles([file], output.name);
    } catch {
      // キャンセル（AbortError）は shareFiles が false で返す。それ以外は案内を出す
      onFailed();
    }
  };
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-11"
      onClick={share}
      title={t("tool.results.shareHint")}
      aria-label={t("tool.results.share")}
    >
      <Share2 aria-hidden />
      <span className="sr-only sm:not-sr-only">{t("tool.results.share")}</span>
    </Button>
  );
}
