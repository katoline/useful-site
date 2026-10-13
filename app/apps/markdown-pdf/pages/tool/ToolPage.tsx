/**
 * ツールページ。features を組み合わせ、依存（adapters）を注入する唯一の場所。
 * 流れ：入力（document-input）→ 描画（render）→ 印刷用の文書（print）→ iframe のプレビュー・印刷
 *
 * 状態は useToolSession（言語切り替えで消えない）に置き、テキストと設定は sessionStorage にも置く
 * （再読み込みで消えない）。画像は File のまま持つので再読み込みでは消える。
 */
import { Download, Eraser, FileText, ImagePlus, Printer, Sparkles, X } from "lucide-react";
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { AdSlot } from "~/platform/ads/AdSlot";
import { formatBytes } from "~/platform/i18n";
import { PageHeader } from "~/platform/shell/PageHeader";
import { useToolSession, useToolSessionStore } from "~/platform/state/ToolSessionProvider";
import { Button } from "~/platform/ui/button";
import { cn } from "~/platform/utils";
import { DEFAULT_SETTINGS, type DocumentSettings } from "../../domain/document-settings";
import {
  IMAGE_EXTENSIONS,
  MAX_IMAGE_COUNT,
  MAX_IMAGE_TOTAL_BYTES,
  MAX_TEXT_BYTES,
  TEXT_EXTENSIONS,
} from "../../domain/limits";
import {
  acceptImages,
  checkTextFile,
  classifyFiles,
  downloadText,
  draftStorage,
  FilePickerButton,
  ImageList,
  isTextWithinLimit,
  MarkdownEditor,
  mergeImages,
  readTextFile,
  useObjectUrls,
} from "../../features/document-input";
import {
  buildPrintDocument,
  documentTitle,
  markdownFileName,
  PreviewFrame,
  type PreviewFrameHandle,
  PrintHelp,
} from "../../features/print";
import { createMarkdownItRenderer, type MarkdownRenderer } from "../../features/render";
import { SettingsPanel, settingsStorage } from "../../features/settings";
import { useMdI18n } from "../../i18n";
import { Faq } from "./faq";

type View = "edit" | "preview";
const KEYS = {
  text: "markdown-pdf:text",
  images: "markdown-pdf:images",
  settings: "markdown-pdf:settings",
  view: "markdown-pdf:view",
} as const;
const PREVIEW_DELAY_MS = 250;

// 描画の実装は一度だけ読み込む（言語切り替えでページが作り直されても読み直さない）
let rendererPromise: Promise<MarkdownRenderer> | null = null;
function loadRenderer(): Promise<MarkdownRenderer> {
  rendererPromise ??= createMarkdownItRenderer().catch((error: unknown) => {
    rendererPromise = null;
    throw error;
  });
  return rendererPromise;
}

const TEXT_ACCEPT = [...TEXT_EXTENSIONS, "text/markdown", "text/plain"].join(",");
const IMAGE_ACCEPT = [...IMAGE_EXTENSIONS, "image/*"].join(",");

export function ToolPage() {
  const { t, lang } = useMdI18n();
  const store = useToolSessionStore();
  const [text, setText] = useToolSession<string>(KEYS.text, "");
  const [images, setImages] = useToolSession<File[]>(KEYS.images, []);
  const [settings, setSettings] = useToolSession<DocumentSettings>(KEYS.settings, DEFAULT_SETTINGS);
  const [view, setView] = useToolSession<View>(KEYS.view, "edit");
  const [messages, setMessages] = useState<string[]>([]);
  const [restored, setRestored] = useState(false);
  const [renderer, setRenderer] = useState<MarkdownRenderer | null>(null);
  const [preview, setPreview] = useState(text);
  const previewRef = useRef<PreviewFrameHandle>(null);
  const editorId = useId();
  const tabsId = useId();

  // 再読み込み対策：このタブの sessionStorage から戻す（言語切り替えではセッションの状態が残っている）
  useEffect(() => {
    if (!store.has(KEYS.text)) {
      const draft = draftStorage.load();
      if (draft) {
        setText(draft);
        setPreview(draft);
      }
    }
    if (!store.has(KEYS.settings)) {
      const saved = settingsStorage.load();
      if (saved) setSettings(saved);
    }
    setRestored(true);
  }, [store, setText, setSettings]);

  // 保存は入力から少し遅らせた値で行う（打鍵ごとに最大 2MB を書かない）
  useEffect(() => {
    if (restored) draftStorage.save(preview);
  }, [restored, preview]);
  useEffect(() => {
    if (restored) settingsStorage.save(settings);
  }, [restored, settings]);

  // 入力から少し遅らせてプレビューを更新する
  useEffect(() => {
    if (preview === text) return;
    const timer = setTimeout(() => setPreview(text), PREVIEW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text, preview]);

  // markdown-it は入力が来てから読み込む（最初の表示に含めない）
  const needsRenderer = preview.length > 0 || text.length > 0;
  useEffect(() => {
    if (!needsRenderer || renderer) return;
    let cancelled = false;
    loadRenderer().then(
      (loaded) => {
        if (!cancelled) setRenderer(loaded);
      },
      () => {
        if (!cancelled) setMessages([t("errors.render")]);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [needsRenderer, renderer, t]);

  const imageUrls = useObjectUrls(images);
  const fallbackName = t("print.defaultName");
  const bodyHtml = useMemo(
    () =>
      renderer && preview
        ? renderer.render(preview, {
            images: imageUrls,
            blockedImageLabel: t("preview.blockedImage"),
          })
        : "",
    [renderer, preview, imageUrls, t],
  );
  const html = useMemo(
    () =>
      buildPrintDocument({
        bodyHtml,
        settings,
        title: documentTitle(preview, fallbackName),
        lang,
      }),
    [bodyHtml, settings, preview, fallbackName, lang],
  );

  const changeText = (value: string) => {
    if (!isTextWithinLimit(value)) {
      setMessages([t("errors.textLimit", { limit: formatBytes(lang, MAX_TEXT_BYTES) })]);
      return;
    }
    setText(value);
  };

  const onFiles = useCallback(
    async (files: File[]) => {
      const { texts, images: imageFiles, unsupported } = classifyFiles(files);
      const next = unsupported.map((file) => t("errors.unsupported", { name: file.name }));
      const [first] = texts;
      if (first) {
        if (texts.length > 1) next.push(t("errors.multipleTexts", { name: first.name }));
        const check = checkTextFile(first);
        if (!check.ok) {
          next.push(
            check.reason === "extension"
              ? t("errors.textExtension", { name: first.name })
              : t("errors.textTooLarge", {
                  name: first.name,
                  limit: formatBytes(lang, MAX_TEXT_BYTES),
                }),
          );
        } else {
          try {
            const content = await readTextFile(first);
            if (isTextWithinLimit(content)) setText(content);
            else
              next.push(
                t("errors.textTooLarge", {
                  name: first.name,
                  limit: formatBytes(lang, MAX_TEXT_BYTES),
                }),
              );
          } catch {
            next.push(t("errors.read", { name: first.name }));
          }
        }
      }
      if (imageFiles.length) {
        const current = store.get<File[]>(KEYS.images) ?? [];
        const { accepted, rejected } = acceptImages(current, imageFiles);
        if (accepted.length) setImages(mergeImages(current, accepted));
        for (const { file, reason } of rejected) {
          next.push(
            reason === "count"
              ? t("errors.imageCount", { name: file.name, limit: MAX_IMAGE_COUNT })
              : reason === "totalSize"
                ? t("errors.imageTotal", {
                    name: file.name,
                    limit: formatBytes(lang, MAX_IMAGE_TOTAL_BYTES),
                  })
                : t("errors.imageExtension", { name: file.name }),
          );
        }
      }
      setMessages(next);
    },
    [t, lang, store, setText, setImages],
  );

  const insertSample = () => {
    const sample = t("sample");
    changeText(text.trim() ? `${text.replace(/\s+$/, "")}\n\n${sample}` : sample);
  };

  const clear = () => {
    setText("");
    setPreview("");
    setImages([]);
    setMessages([]);
  };

  const savePdf = () => {
    // 入力の直後でも最新の内容を印刷する。スマホではプレビューを表示してから印刷する
    flushSync(() => {
      setPreview(text);
      setView("preview");
    });
    previewRef.current?.print(documentTitle(text, fallbackName));
  };

  const onTabKey = (event: KeyboardEvent) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next: View = view === "edit" ? "preview" : "edit";
    setView(next);
    document.getElementById(`${tabsId}-${next}-tab`)?.focus();
  };

  const hasText = text.trim().length > 0;
  const tab = (value: View) => ({
    id: `${tabsId}-${value}-tab`,
    role: "tab" as const,
    type: "button" as const,
    "aria-selected": view === value,
    "aria-controls": `${tabsId}-${value}`,
    tabIndex: view === value ? 0 : -1,
    onClick: () => setView(value),
    onKeyDown: onTabKey,
    "data-testid": `tab-${value}`,
    className: cn(
      "inline-flex h-full items-center justify-center rounded-sm px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
      view === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
    ),
  });
  const panel = (value: View) => ({
    id: `${tabsId}-${value}`,
    role: "tabpanel" as const,
    "aria-labelledby": `${tabsId}-${value}-tab`,
    // スマホでは選んだ方だけ、PC では両方を左右に並べる
    className: cn("relative min-w-0", view !== value && "max-md:hidden"),
  });

  return (
    <>
      <PageHeader title={t("page.title")} lead={t("page.lead")} />

      <div className="flex flex-wrap gap-2" data-testid="input-toolbar">
        <FilePickerButton
          label={t("editor.fileLabel")}
          accept={TEXT_ACCEPT}
          onFiles={onFiles}
          testId="markdown-file-input"
        >
          <FileText aria-hidden />
          {t("editor.openFile")}
        </FilePickerButton>
        <FilePickerButton
          label={t("editor.imageLabel")}
          accept={IMAGE_ACCEPT}
          multiple
          onFiles={onFiles}
          testId="image-file-input"
        >
          <ImagePlus aria-hidden />
          {t("editor.addImages")}
        </FilePickerButton>
        <Button variant="outline" onClick={insertSample} data-testid="insert-sample">
          <Sparkles aria-hidden />
          {t("editor.insertSample")}
        </Button>
        <Button
          variant="outline"
          onClick={() => downloadText(markdownFileName(text, fallbackName), text)}
          disabled={!hasText}
          data-testid="save-markdown"
        >
          <Download aria-hidden />
          {t("editor.saveMarkdown")}
        </Button>
        <Button variant="ghost" onClick={clear} disabled={!text && images.length === 0}>
          <Eraser aria-hidden />
          {t("editor.clear")}
        </Button>
      </div>

      {messages.length > 0 && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm"
          data-testid="input-messages"
        >
          <ul className="flex-1 space-y-1">
            {messages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("errors.dismiss")}
            onClick={() => setMessages([])}
          >
            <X aria-hidden />
          </Button>
        </div>
      )}

      <div className="mt-4">
        <ImageList
          images={images}
          onRemove={(name) => setImages(images.filter((file) => file.name !== name))}
        />
      </div>

      <div
        role="tablist"
        aria-label={t("tabs.label")}
        className="mt-4 grid h-11 w-full grid-cols-2 rounded-md bg-muted p-1 md:hidden"
      >
        <button {...tab("edit")}>{t("tabs.edit")}</button>
        <button {...tab("preview")}>{t("tabs.preview")}</button>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div {...panel("edit")}>
          <MarkdownEditor
            id={editorId}
            value={text}
            onChange={changeText}
            onFiles={onFiles}
            className="h-[70vh]"
          />
        </div>
        <div {...panel("preview")}>
          <PreviewFrame
            ref={previewRef}
            html={html}
            title={t("preview.frameTitle")}
            className="h-[70vh]"
          />
          {!hasText && (
            <p className="pointer-events-none absolute inset-x-4 top-8 text-center text-sm text-neutral-500">
              <span className="max-md:hidden">{t("preview.empty")}</span>
              <span className="md:hidden">{t("preview.emptyMobile")}</span>
            </p>
          )}
          {hasText && !renderer && (
            <p
              role="status"
              className="pointer-events-none absolute inset-x-4 top-8 text-center text-sm text-neutral-500"
            >
              {t("preview.loading")}
            </p>
          )}
        </div>
      </div>

      <div className="mt-8 rounded-lg border border-border p-4">
        <SettingsPanel settings={settings} onChange={setSettings} />
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-start">
        <Button
          size="lg"
          onClick={savePdf}
          disabled={!hasText || !renderer}
          data-testid="save-pdf"
          className="shrink-0"
        >
          <Printer aria-hidden />
          {t("print.save")}
        </Button>
        <PrintHelp />
      </div>

      <Faq />

      <div className="mt-12">
        <AdSlot format="responsive" />
      </div>
    </>
  );
}
