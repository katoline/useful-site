/**
 * ZIP 保存・含まれるファイル・<head> に貼る HTML。
 */
import { Check, Copy, Download } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { formatBytes, useI18n } from "~/apps/image-adjust/i18n";
import { FILE_NAMES } from "~/apps/image-adjust/lib/icons/specs";
import { buildIconZip, type IconFile } from "~/apps/image-adjust/lib/icons/zip";
import { Button } from "~/platform/ui/button";

/** 生成したファイルを ZIP にして保存する（PC のカードとスマホの固定バーで共用） */
export function downloadIconZip(files: readonly IconFile[]) {
  const zip = buildIconZip(files);
  saveBlob(new Blob([zip as Uint8Array<ArrayBuffer>], { type: "application/zip" }), FILE_NAMES.zip);
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  // ダウンロードが始まるまで少し待ってから解放する
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

type CopyState = "idle" | "copied" | "failed";

export function IconOutput({
  files,
  ready,
  snippet,
  notes,
}: {
  files: readonly IconFile[] | null;
  /** 今の設定で生成し終わっているか（古い結果は保存させない） */
  ready: boolean;
  snippet: string;
  notes: string[];
}) {
  const { t, lang } = useI18n();
  const snippetId = useId();
  const [copy, setCopy] = useState<CopyState>("idle");

  useEffect(() => {
    if (copy === "idle") return;
    const timer = setTimeout(() => setCopy("idle"), 2500);
    return () => clearTimeout(timer);
  }, [copy]);

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopy("copied");
    } catch {
      setCopy("failed");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Button
          size="lg"
          // スマホでは画面下の固定バーに出すので、ここは PC だけ
          className="hidden self-start md:inline-flex"
          disabled={!files || !ready}
          onClick={() => files && downloadIconZip(files)}
          data-testid="icons-download-zip"
        >
          <Download aria-hidden />
          {t("icons.output.download")}
        </Button>
        {files && (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">
              {t("icons.output.files", { count: files.length })}
            </summary>
            <ul className="mt-2 flex flex-col gap-1 tabular-nums" data-testid="icons-file-list">
              {files.map((file) => (
                <li key={file.name} className="flex justify-between gap-4">
                  <span className="font-mono">{file.name}</span>
                  <span className="text-muted-foreground">
                    {formatBytes(lang, file.data.length)}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={snippetId} className="text-sm font-medium">
            {t("icons.output.snippet")}
          </label>
          <Button
            variant="outline"
            size="sm"
            onClick={copySnippet}
            data-testid="icons-copy-snippet"
          >
            {copy === "copied" ? <Check aria-hidden /> : <Copy aria-hidden />}
            {copy === "copied" ? t("icons.output.copied") : t("icons.output.copy")}
          </Button>
        </div>
        <textarea
          id={snippetId}
          readOnly
          value={snippet}
          rows={snippet.split("\n").length}
          spellCheck={false}
          className="w-full resize-y rounded-md border border-input bg-background p-3 font-mono text-xs leading-relaxed"
          data-testid="icons-snippet"
          onFocus={(e) => e.currentTarget.select()}
        />
        <p aria-live="polite" className="text-xs text-muted-foreground">
          {copy === "failed" ? t("icons.output.copyFailed") : ""}
        </p>
        {notes.map((note) => (
          <p key={note} className="text-xs text-muted-foreground">
            {note}
          </p>
        ))}
      </div>
    </div>
  );
}
