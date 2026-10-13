/**
 * 入力エリア（§2.3・§6.2）。
 * - スマホ：「写真を選ぶ」（accept="image/*"）を大きく。ドロップエリアは出さない
 * - PC：ドラッグ＆ドロップ（フォルダ可）＋ ファイル / フォルダ / ZIP の選択
 * - 共通：URL 入力欄
 */
import { FolderOpen, Images, Link as LinkIcon, LoaderCircle, Upload } from "lucide-react";
import { type DragEvent, type FormEvent, useId, useRef, useState } from "react";
import { useI18n } from "~/apps/image-adjust/i18n";
import { useOnline } from "~/platform/hooks/use-online";
import { Button } from "~/platform/ui/button";
import { Input } from "~/platform/ui/input";
import { Label } from "~/platform/ui/label";
import { cn } from "~/platform/utils";
import { filesFromDrop, filesFromInput, type PickedFile } from "./collect-files";

const ACCEPT_IMAGES =
  "image/png,image/jpeg,image/webp,image/gif,image/svg+xml,.png,.jpg,.jpeg,.webp,.gif,.svg";
const ACCEPT_WITH_ZIP = `${ACCEPT_IMAGES},.zip,application/zip,application/x-zip-compressed`;

export interface FileInputProps {
  onFiles: (files: PickedFile[]) => void;
  onUrl: (url: string) => Promise<void>;
  urlBusy: boolean;
  urlError: string | null;
}

export function FileInput({ onFiles, onUrl, urlBusy, urlError }: FileInputProps) {
  const { t } = useI18n();
  const online = useOnline();
  const [dragging, setDragging] = useState(false);
  const [url, setUrl] = useState("");
  const photoRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const urlId = useId();

  const handleInput = (input: HTMLInputElement) => {
    onFiles(filesFromInput(input.files));
    // 同じファイルをもう一度選べるようにする
    input.value = "";
  };

  const onDrop = async (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    setDragging(false);
    onFiles(await filesFromDrop(e.dataTransfer));
  };

  const submitUrl = async (e: FormEvent) => {
    e.preventDefault();
    if (!url.trim() || urlBusy) return;
    await onUrl(url.trim());
    setUrl("");
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 実体の <input>。ボタンから開く */}
      <input
        ref={photoRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        data-testid="photo-input"
        onChange={(e) => handleInput(e.currentTarget)}
      />
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT_WITH_ZIP}
        multiple
        className="hidden"
        data-testid="file-input"
        onChange={(e) => handleInput(e.currentTarget)}
      />
      <input
        ref={folderRef}
        type="file"
        // @ts-expect-error webkitdirectory は React の型に無い
        webkitdirectory=""
        multiple
        className="hidden"
        data-testid="folder-input"
        onChange={(e) => handleInput(e.currentTarget)}
      />

      {/* スマホ：大きな「写真を選ぶ」 */}
      <div className="flex flex-col gap-2 md:hidden">
        <Button
          size="lg"
          className="h-16 w-full text-lg"
          onClick={() => photoRef.current?.click()}
          data-testid="choose-photos"
        >
          <Images className="!size-6" aria-hidden />
          {t("tool.input.choosePhotos")}
        </Button>
        <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>
          <Upload aria-hidden />
          {t("tool.input.chooseFiles")}
        </Button>
      </div>

      {/* PC：ドロップエリア */}
      <section
        aria-label={t("tool.input.dropHint")}
        data-testid="drop-zone"
        className={cn(
          "hidden flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 text-center transition-colors md:flex",
          dragging ? "border-primary bg-accent" : "border-border bg-surface",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <Upload className="size-8 text-muted-foreground" aria-hidden />
        <p className="text-base font-medium">{t("tool.input.dropHint")}</p>
        <p className="text-sm text-muted-foreground">{t("tool.input.dropOr")}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => fileRef.current?.click()} data-testid="choose-files">
            <Images aria-hidden />
            {t("tool.input.chooseFiles")}
          </Button>
          <Button variant="outline" onClick={() => folderRef.current?.click()}>
            <FolderOpen aria-hidden />
            {t("tool.input.chooseFolder")}
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload aria-hidden />
            {t("tool.input.chooseZip")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t("tool.input.acceptNote")}</p>
      </section>
      <p className="text-xs text-muted-foreground md:hidden">{t("tool.input.acceptNote")}</p>

      {/* URL 入力 */}
      <form onSubmit={submitUrl} className="flex flex-col gap-2">
        <Label htmlFor={urlId}>{t("tool.input.urlLabel")}</Label>
        <div className="flex gap-2">
          <Input
            id={urlId}
            type="url"
            inputMode="url"
            placeholder={t("tool.input.urlPlaceholder")}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={urlBusy || !online}
            data-testid="url-input"
          />
          <Button type="submit" variant="outline" disabled={urlBusy || !online || !url.trim()}>
            {urlBusy ? (
              <LoaderCircle className="animate-spin" aria-hidden />
            ) : (
              <LinkIcon aria-hidden />
            )}
            <span className="hidden sm:inline">
              {urlBusy ? t("tool.input.urlLoading") : t("tool.input.urlAdd")}
            </span>
          </Button>
        </div>
        {!online && <p className="text-xs text-muted-foreground">{t("tool.input.urlOffline")}</p>}
        {urlError && (
          <p className="text-sm text-destructive" role="alert">
            {urlError}
          </p>
        )}
      </form>
    </div>
  );
}
