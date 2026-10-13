/** 一緒に入れた画像の一覧（相対パスの画像の解決に使う） */
import { X } from "lucide-react";
import { formatBytes } from "~/platform/i18n";
import { Button } from "~/platform/ui/button";
import { useMdI18n } from "../../../i18n";

export function ImageList({
  images,
  onRemove,
}: {
  images: readonly File[];
  onRemove(name: string): void;
}) {
  const { t, lang } = useMdI18n();
  if (images.length === 0) return null;
  const total = images.reduce((sum, file) => sum + file.size, 0);
  return (
    <section aria-labelledby="md-images-title" className="flex flex-col gap-2">
      <h3 id="md-images-title" className="text-sm font-medium">
        {t("editor.images", { count: images.length, size: formatBytes(lang, total) })}
      </h3>
      <p className="text-xs text-muted-foreground">{t("editor.imagesHint")}</p>
      <ul className="flex flex-wrap gap-2" data-testid="image-list">
        {images.map((file) => (
          <li
            key={file.name}
            className="flex items-center gap-1 rounded-md border border-border bg-surface pl-3 text-sm"
          >
            <span className="max-w-48 truncate">{file.name}</span>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("editor.removeImage", { name: file.name })}
              onClick={() => onRemove(file.name)}
            >
              <X aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
