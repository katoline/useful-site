/**
 * 元画像の入力（ファイル選択。PC ではドラッグ＆ドロップも）。
 */
import { ImageUp } from "lucide-react";
import { type DragEvent, useRef, useState } from "react";
import { useI18n } from "~/apps/image-adjust/i18n";
import {
  type IconSource,
  IconSourceError,
  loadIconSource,
} from "~/apps/image-adjust/lib/icons/source";
import { Button } from "~/platform/ui/button";
import { cn } from "~/platform/utils";

const ACCEPT = "image/svg+xml,.svg,image/png,image/jpeg,image/webp,image/gif,image/avif";

export function SourceInput({
  source,
  onSource,
}: {
  source: IconSource | null;
  onSource: (source: IconSource) => void;
}) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      onSource(await loadIconSource(file));
    } catch (e) {
      const code = e instanceof IconSourceError ? e.code : "decode";
      setError(t(`icons.errors.${code}`));
    } finally {
      setLoading(false);
    }
  }

  function onDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDragging(false);
    void handleFile(event.dataTransfer.files[0]);
  }

  return (
    <section
      aria-label={t("icons.input.fileLabel")}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border border-border bg-surface p-6 text-center pointer-fine:border-dashed",
        dragging && "border-foreground",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        aria-label={t("icons.input.fileLabel")}
        data-testid="icons-file-input"
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <Button size="lg" onClick={() => inputRef.current?.click()} disabled={loading}>
        <ImageUp aria-hidden />
        {source ? t("icons.input.change") : t("icons.input.choose")}
      </Button>
      {/* ドラッグ＆ドロップの案内は PC（マウス操作）だけ（§6.2） */}
      <p className="hidden text-sm text-muted-foreground pointer-fine:block">
        {t("icons.input.drop")}
      </p>
      <p className="text-sm text-muted-foreground">{t("icons.input.hint")}</p>
      {source && (
        <p className="text-sm tabular-nums" data-testid="icons-source-info">
          {t("icons.input.current", {
            name: source.fileName,
            width: Math.round(source.originalWidth),
            height: Math.round(source.originalHeight),
          })}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
