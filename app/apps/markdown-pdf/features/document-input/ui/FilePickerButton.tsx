/** ファイル選択のボタン（input[type=file] はラベルで包んで、見た目をボタンにする） */
import type { ReactNode } from "react";
import { buttonVariants } from "~/platform/ui/button";
import { cn } from "~/platform/utils";

export function FilePickerButton({
  children,
  label,
  accept,
  multiple = false,
  onFiles,
  testId,
}: {
  children: ReactNode;
  /** input の名前（読み上げ用） */
  label: string;
  accept: string;
  multiple?: boolean;
  onFiles(files: File[]): void;
  testId?: string;
}) {
  return (
    <label
      className={cn(
        buttonVariants({ variant: "outline" }),
        "cursor-pointer focus-within:ring-2 focus-within:ring-ring",
      )}
    >
      {children}
      <input
        type="file"
        className="sr-only"
        aria-label={label}
        accept={accept}
        multiple={multiple}
        data-testid={testId}
        onChange={(event) => {
          const files = [...(event.currentTarget.files ?? [])];
          // 同じファイルを続けて選んでも change が来るよう空にする
          event.currentTarget.value = "";
          if (files.length) onFiles(files);
        }}
      />
    </label>
  );
}
