/**
 * レスポンシブ書き出しの <picture> / srcset スニペット（§2.5）。
 * 実際に書き出したファイル名と実寸から作る。
 */
import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "~/apps/image-adjust/i18n";
import {
  pictureSnippet,
  type SnippetVariant,
  srcsetSnippet,
} from "~/apps/image-adjust/lib/pipeline/presets";
import { Button } from "~/platform/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/platform/ui/dialog";
import type { ToolItem } from "./types";

function buildSnippets(item: ToolItem): { picture: string; img: string } | null {
  const result = item.result;
  if (!result) return null;
  const variants: SnippetVariant[] = result.outputs
    .filter((o) => o.variantWidth && o.width)
    .map((o) => ({ file: o.name, width: o.width ?? 0, height: o.height }));
  const first = result.outputs[0];
  if (variants.length === 0 || !first) return null;
  const base = { format: first.format, variants };
  return { picture: pictureSnippet(base), img: srcsetSnippet(base) };
}

export function SnippetDialog({
  item,
  open,
  onOpenChange,
}: {
  item: ToolItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  const snippets = buildSnippets(item);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" closeLabel={t("common.close")}>
        <DialogHeader>
          <DialogTitle>{t("tool.results.snippetTitle")}</DialogTitle>
        </DialogHeader>
        {snippets && (
          <div className="flex flex-col gap-4">
            <SnippetBlock label="<picture>" code={snippets.picture} />
            <SnippetBlock label="<img srcset>" code={snippets.img} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SnippetBlock({ label, code }: { label: string; code: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // クリップボードが使えない環境では textarea から手でコピーしてもらう
    }
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm">{label}</span>
        <Button variant="outline" size="sm" onClick={copy}>
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? t("tool.results.copied") : t("tool.results.copy")}
        </Button>
      </div>
      <textarea
        readOnly
        value={code}
        rows={Math.min(12, code.split("\n").length + 1)}
        className="w-full rounded-md border border-border bg-surface p-3 font-mono text-xs"
        aria-label={label}
        onFocus={(e) => e.currentTarget.select()}
      />
    </div>
  );
}
