/**
 * 中央アイコンの選択（なし／汎用／ブランド／自分の画像）。選択は親が持ち、ここは props で通知するだけ。
 * 選択しても URL は変えない。タップ領域は 44px 以上、選択状態は aria-pressed で伝える。
 */
import { type ChangeEvent, useEffect, useState } from "react";
import { formatBytes, type Lang } from "~/platform/i18n";
import { Button, buttonVariants } from "~/platform/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/platform/ui/tabs";
import { cn } from "~/platform/utils";
import {
  BRAND_ICON_IDS,
  GENERIC_ICON_IDS,
  type IconId,
  type IconSelection,
  isBrandIconId,
  MAX_ICON_SOURCE_BYTES,
  MAX_ICON_SOURCE_DIMENSION,
} from "../../../domain/icons";
import { type DictKey, type TFunction, useQrI18n } from "../../../i18n";
import { builtinIconDefinition } from "../adapters/builtin-icons";
import { IconGlyph } from "./IconGlyph";
import type { IconSelectionError, IconSelectionStatus } from "./use-icon-selection";

type IconTab = "none" | "generic" | "brand" | "upload";

/** 選択の内容から見せるべきタブを決める（言語切り替えで作り直されても選択が隠れないように） */
function tabForSelection(selection: IconSelection): IconTab {
  switch (selection.kind) {
    case "image":
      return "upload";
    case "builtin":
      return isBrandIconId(selection.id) ? "brand" : "generic";
    case "none":
      return "none";
  }
}

const ACCEPT = "image/png,image/jpeg,image/webp";

export interface IconPickerProps {
  selection: IconSelection;
  status: IconSelectionStatus;
  error: IconSelectionError | null;
  onSelectNone(): void;
  onSelectBuiltin(id: IconId): void;
  onSelectImage(file: File): void;
  onDismissError(): void;
  className?: string;
}

function iconNameKey(id: IconId): DictKey {
  return `icon.icons.${id}`;
}

function errorMessage(t: TFunction, lang: Lang, error: IconSelectionError): string {
  switch (error.reason) {
    case "type":
      return t("errors.iconType", { name: error.fileName });
    case "size":
      return t("errors.iconSize", {
        name: error.fileName,
        limit: formatBytes(lang, MAX_ICON_SOURCE_BYTES),
      });
    case "dimension":
      return t("errors.iconDimension", {
        name: error.fileName,
        limit: `${MAX_ICON_SOURCE_DIMENSION}px`,
      });
    case "decode":
      return t("errors.iconRead", { name: error.fileName });
  }
}

function IconOption({
  id,
  selected,
  onSelect,
}: {
  id: IconId;
  selected: boolean;
  onSelect(id: IconId): void;
}) {
  const { t } = useQrI18n();
  return (
    <Button
      type="button"
      variant={selected ? "secondary" : "outline"}
      aria-pressed={selected}
      onClick={() => onSelect(id)}
      data-testid={`icon-option-${id}`}
      className="h-auto min-h-14 flex-col gap-1 px-2 py-2 [&_svg]:size-6"
    >
      <IconGlyph definition={builtinIconDefinition(id)} />
      <span className="text-xs leading-tight">{t(iconNameKey(id))}</span>
    </Button>
  );
}

export function IconPicker({
  selection,
  status,
  error,
  onSelectNone,
  onSelectBuiltin,
  onSelectImage,
  onDismissError,
  className,
}: IconPickerProps) {
  const { t, lang } = useQrI18n();
  const [tab, setTab] = useState<IconTab>(() => tabForSelection(selection));

  // 選択が変わったら、その選択が見えるタブへ合わせる（作り直し後・アップロード完了後など）
  // アイコンなしのときは、ユーザーが見ているタブを勝手に変えない
  useEffect(() => {
    if (selection.kind !== "none") setTab(tabForSelection(selection));
  }, [selection]);

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    // 同じファイルを続けて選んでも change が来るよう空にする
    event.currentTarget.value = "";
    if (file) onSelectImage(file);
  };

  const selectedBuiltin = selection.kind === "builtin" ? selection.id : undefined;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {error ? (
        <div
          role="alert"
          data-testid="icon-error"
          className="flex items-start justify-between gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3"
        >
          <p className="text-sm text-destructive">{errorMessage(t, lang, error)}</p>
          <Button type="button" variant="ghost" onClick={onDismissError}>
            {t("errors.dismiss")}
          </Button>
        </div>
      ) : null}

      <Tabs value={tab} onValueChange={(value) => setTab(value as IconTab)}>
        <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="none" data-testid="icon-tab-none" className="min-h-11">
            {t("icon.none")}
          </TabsTrigger>
          <TabsTrigger value="generic" data-testid="icon-tab-generic" className="min-h-11">
            {t("icon.generic")}
          </TabsTrigger>
          <TabsTrigger value="brand" data-testid="icon-tab-brand" className="min-h-11">
            {t("icon.brand")}
          </TabsTrigger>
          <TabsTrigger value="upload" data-testid="icon-tab-upload" className="min-h-11">
            {t("icon.upload")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="none">
          <Button
            type="button"
            variant={selection.kind === "none" ? "secondary" : "outline"}
            aria-pressed={selection.kind === "none"}
            onClick={onSelectNone}
            data-testid="icon-none"
          >
            {t("icon.none")}
          </Button>
        </TabsContent>

        <TabsContent value="generic">
          <fieldset className="m-0 grid grid-cols-4 gap-2 border-0 p-0 sm:grid-cols-5">
            <legend className="sr-only">{t("icon.generic")}</legend>
            {GENERIC_ICON_IDS.map((id) => (
              <IconOption
                key={id}
                id={id}
                selected={selectedBuiltin === id}
                onSelect={onSelectBuiltin}
              />
            ))}
          </fieldset>
        </TabsContent>

        <TabsContent value="brand">
          <fieldset className="m-0 grid grid-cols-4 gap-2 border-0 p-0 sm:grid-cols-5">
            <legend className="sr-only">{t("icon.brand")}</legend>
            {BRAND_ICON_IDS.map((id) => (
              <IconOption
                key={id}
                id={id}
                selected={selectedBuiltin === id}
                onSelect={onSelectBuiltin}
              />
            ))}
          </fieldset>
        </TabsContent>

        <TabsContent value="upload" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <label
              className={cn(
                buttonVariants({ variant: "outline" }),
                "cursor-pointer focus-within:ring-2 focus-within:ring-ring",
              )}
            >
              {t("icon.uploadLabel")}
              <input
                type="file"
                accept={ACCEPT}
                className="sr-only"
                aria-label={t("icon.uploadLabel")}
                data-testid="icon-upload"
                onChange={handleFiles}
              />
            </label>
            {selection.kind === "image" ? (
              <Button
                type="button"
                variant="ghost"
                onClick={onSelectNone}
                data-testid="icon-remove"
              >
                {t("icon.remove")}
              </Button>
            ) : null}
          </div>

          {status === "loading" ? (
            <p role="status" className="text-sm text-muted-foreground">
              {t("icon.choosing")}
            </p>
          ) : null}

          {selection.kind === "image" ? (
            <img
              src={selection.dataUrl}
              alt=""
              className="size-16 rounded-md border border-border bg-checker object-contain"
            />
          ) : null}

          <p className="text-sm text-muted-foreground">{t("icon.hint")}</p>
          <p className="text-xs text-muted-foreground">{t("icon.credits")}</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
