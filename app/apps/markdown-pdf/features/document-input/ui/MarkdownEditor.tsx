/** Markdown の入力欄。ファイルのドラッグ＆ドロップも受け付ける */

import { cn } from "~/platform/utils";
import { useMdI18n } from "../../../i18n";
import { useFileDrop } from "../adapters/drop";

export function MarkdownEditor({
  id,
  value,
  onChange,
  onFiles,
  className,
}: {
  id: string;
  value: string;
  onChange(value: string): void;
  onFiles(files: File[]): void;
  className?: string;
}) {
  const { t } = useMdI18n();
  const { dragging, handlers } = useFileDrop(onFiles);
  return (
    <div className={cn("relative", className)} {...handlers}>
      <label htmlFor={id} className="sr-only">
        {t("editor.label")}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t("editor.placeholder")}
        spellCheck={false}
        data-testid="markdown-input"
        className="block h-full min-h-80 w-full resize-y rounded-md border border-input bg-background p-3 font-mono text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {dragging && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-md border-2 border-dashed border-primary bg-background/90 p-4 text-center text-sm font-medium"
        >
          {t("editor.dropHere")}
        </div>
      )}
    </div>
  );
}
