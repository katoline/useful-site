/**
 * 処理前後の比較（§2.2・§8.3）。スライダーで左右に分けて見比べる。背景は市松 / 白 / 黒。
 * SVG は usePreviewUrl がラスタライズした PNG を出す（blob: の SVG は DOM に出さない。preview.ts）。
 */
import { useEffect, useId, useState } from "react";
import { formatBytes, useI18n } from "~/apps/image-adjust/i18n";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/platform/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "~/platform/ui/toggle-group";
import { cn } from "~/platform/utils";
import { loadSource } from "./engine";
import { usePreviewUrl } from "./hooks";
import type { ToolItem, ToolOutput } from "./types";

export type CompareBackground = "checker" | "white" | "black";

const BG_CLASS: Record<CompareBackground, string> = {
  checker: "bg-checker",
  white: "bg-white",
  black: "bg-black",
};

export function CompareDialog({
  item,
  outputs,
  open,
  onOpenChange,
}: {
  item: ToolItem;
  outputs: ToolOutput[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t, lang } = useI18n();
  const [position, setPosition] = useState(50);
  const [background, setBackground] = useState<CompareBackground>("checker");
  const [source, setSource] = useState<{ item: ToolItem; blob: Blob | null } | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const sliderId = useId();
  const defaultOutput = outputs.reduce<ToolOutput | undefined>(
    (largest, candidate) =>
      !largest ||
      (candidate.variantWidth ?? candidate.width ?? 0) >
        (largest.variantWidth ?? largest.width ?? 0)
        ? candidate
        : largest,
    undefined,
  );
  const output = outputs.find((candidate) => candidate.path === selectedPath) ?? defaultOutput;
  const beforeBlob = open && source?.item === item ? source.blob : null;
  const beforeUrl = usePreviewUrl(beforeBlob, item.result?.inputFormat ?? null);
  const afterUrl = usePreviewUrl(open ? output?.blob : null, output?.format ?? null);

  useEffect(() => {
    setSource(null);
    setSelectedPath(defaultOutput?.path ?? null);
    if (!open) return;
    let active = true;
    loadSource(item).then(
      (blob) => {
        if (active) setSource({ item, blob });
      },
      () => {
        if (active) setSource({ item, blob: null });
      },
    );
    return () => {
      active = false;
      setSource(null);
    };
  }, [defaultOutput?.path, item, open]);

  if (!output) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-w-4xl flex-col" closeLabel={t("common.close")}>
        <DialogHeader className="shrink-0">
          <DialogTitle>{t("tool.compare.title")}</DialogTitle>
          <DialogDescription>{t("tool.compare.description")}</DialogDescription>
        </DialogHeader>

        <div
          className={cn(
            "relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-md border border-border",
            BG_CLASS[background],
          )}
          data-testid="compare-stage"
        >
          {/* 処理後（下）。処理前（上）を clip-path で左側だけ見せる */}
          {afterUrl && (
            <img
              src={afterUrl}
              alt={t("tool.compare.after")}
              className="absolute inset-0 size-full object-contain"
              draggable={false}
            />
          )}
          {beforeUrl && (
            <img
              src={beforeUrl}
              alt={t("tool.compare.before")}
              className="absolute inset-0 size-full object-contain"
              style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
              draggable={false}
            />
          )}
          {!beforeBlob && (
            <span
              role="status"
              className="absolute bottom-2 left-2 rounded bg-background/80 px-2 py-1 text-sm"
            >
              {t(source?.item === item ? "tool.compare.loadFailed" : "tool.compare.loading")}
            </span>
          )}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 w-0.5 bg-primary shadow"
            style={{ left: `${position}%` }}
          />
          <span className="pointer-events-none absolute top-2 left-2 rounded bg-background/80 px-2 py-0.5 text-xs tabular-nums">
            {t("tool.compare.before")} · {formatBytes(lang, item.size)}
          </span>
          <span className="pointer-events-none absolute top-2 right-2 rounded bg-background/80 px-2 py-0.5 text-xs tabular-nums">
            {t("tool.compare.after")} · {formatBytes(lang, output.blob.size)}
            {output.width && output.height ? ` · ${output.width}×${output.height}` : ""}
          </span>
        </div>

        <div className="flex shrink-0 flex-col gap-3">
          {outputs.length > 1 && (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-muted-foreground">{t("tool.compare.outputWidth")}</span>
              <ToggleGroup
                type="single"
                value={output.path}
                onValueChange={(value) => value && setSelectedPath(value)}
                aria-label={t("tool.compare.outputWidth")}
              >
                {outputs.map((candidate) => (
                  <ToggleGroupItem key={candidate.path} value={candidate.path} className="h-11">
                    {(candidate.variantWidth ?? candidate.width)
                      ? `${candidate.variantWidth ?? candidate.width}px`
                      : candidate.name}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          )}
          <label htmlFor={sliderId} className="sr-only">
            {t("tool.compare.slider")}
          </label>
          <input
            id={sliderId}
            type="range"
            min={0}
            max={100}
            value={position}
            onChange={(e) => setPosition(Number(e.target.value))}
            className="h-11 w-full accent-primary"
            data-testid="compare-slider"
          />
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{t("tool.compare.background")}</span>
            <ToggleGroup
              type="single"
              value={background}
              onValueChange={(v) => v && setBackground(v as CompareBackground)}
              aria-label={t("tool.compare.background")}
            >
              <ToggleGroupItem value="checker" className="h-11">
                {t("tool.compare.checker")}
              </ToggleGroupItem>
              <ToggleGroupItem value="white" className="h-11">
                {t("tool.compare.white")}
              </ToggleGroupItem>
              <ToggleGroupItem value="black" className="h-11">
                {t("tool.compare.black")}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
