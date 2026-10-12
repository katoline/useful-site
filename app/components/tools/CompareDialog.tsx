/**
 * 処理前後の比較（§2.2・§8.3）。スライダーで左右に分けて見比べる。背景は市松 / 白 / 黒。
 * SVG は usePreviewUrl がラスタライズした PNG を出す（blob: の SVG は DOM に出さない。preview.ts）。
 */
import { useId, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { formatBytes, useI18n } from "~/i18n";
import { cn } from "~/lib/utils";
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
  output,
  open,
  onOpenChange,
}: {
  item: ToolItem;
  output: ToolOutput;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t, lang } = useI18n();
  const [position, setPosition] = useState(50);
  const [background, setBackground] = useState<CompareBackground>("checker");
  const sliderId = useId();
  const beforeUrl = usePreviewUrl(open ? item.source : null, item.result?.inputFormat ?? null);
  const afterUrl = usePreviewUrl(open ? output.blob : null, output.format);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl" closeLabel={t("common.close")}>
        <DialogHeader>
          <DialogTitle>{t("tool.compare.title")}</DialogTitle>
          <DialogDescription>{t("tool.compare.description")}</DialogDescription>
        </DialogHeader>

        <div
          className={cn(
            "relative aspect-[4/3] w-full overflow-hidden rounded-md border border-border",
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
          </span>
        </div>

        <div className="flex flex-col gap-3">
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
              <ToggleGroupItem value="checker">{t("tool.compare.checker")}</ToggleGroupItem>
              <ToggleGroupItem value="white">{t("tool.compare.white")}</ToggleGroupItem>
              <ToggleGroupItem value="black">{t("tool.compare.black")}</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
