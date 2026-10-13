/** プレビュー（＝印刷する文書）の iframe。sandbox 付きの srcdoc に描く */
import { type Ref, useEffect, useImperativeHandle, useRef } from "react";
import { cn } from "~/platform/utils";
import {
  handleFrameLinks,
  PREVIEW_SANDBOX,
  printFrame,
  restoreFrameScroll,
} from "../adapters/frame";

export interface PreviewFrameHandle {
  /** 中身を印刷する。読み込み中なら読み込み後に印刷する */
  print(title: string): void;
}

export function PreviewFrame({
  html,
  title,
  className,
  ref,
}: {
  html: string;
  /** iframe の名前（読み上げ用） */
  title: string;
  className?: string;
  ref?: Ref<PreviewFrameHandle>;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const loadedHtml = useRef<string | null>(null);
  const scrollY = useRef(0);
  const pendingPrint = useRef<string | null>(null);
  const cleanup = useRef<(() => void) | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      print(documentTitle: string) {
        const frame = frameRef.current;
        if (!frame) return;
        if (loadedHtml.current === html) printFrame(frame, documentTitle);
        else pendingPrint.current = documentTitle;
      },
    }),
    [html],
  );

  useEffect(
    () => () => {
      cleanup.current?.();
    },
    [],
  );

  const onLoad = () => {
    const frame = frameRef.current;
    if (!frame) return;
    loadedHtml.current = frame.srcdoc;
    cleanup.current?.();
    const win = frame.contentWindow;
    const onScroll = () => {
      scrollY.current = win?.scrollY ?? 0;
    };
    const removeLinks = handleFrameLinks(frame);
    win?.addEventListener("scroll", onScroll, { passive: true });
    cleanup.current = () => {
      removeLinks();
      win?.removeEventListener("scroll", onScroll);
    };
    restoreFrameScroll(frame, scrollY.current);
    if (pendingPrint.current !== null && loadedHtml.current === html) {
      const documentTitle = pendingPrint.current;
      pendingPrint.current = null;
      printFrame(frame, documentTitle);
    }
  };

  return (
    <iframe
      ref={frameRef}
      title={title}
      sandbox={PREVIEW_SANDBOX}
      srcDoc={html}
      onLoad={onLoad}
      data-testid="preview-frame"
      className={cn("block w-full rounded-md border border-border bg-white", className)}
    />
  );
}
