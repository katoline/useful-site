/**
 * アイコン選択の非同期読み込みを扱うフック。
 * 選択そのものは親（useToolSession）が持ち、ここは「読み込みの進行・失敗・競合の防止」だけを見る。
 * status を親へ返すので、読み込み中は保存を無効にできる。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  builtinIcon,
  type IconArtwork,
  type IconId,
  type IconImageErrorReason,
  type IconSelection,
  imageIcon,
  noIcon,
} from "../../../domain/icons";
import { artworkForSelection } from "../adapters/builtin-icons";
import { decodeIconImage, IconImageAbortError, IconImageError } from "../adapters/image-loader";
import { checkIconFile } from "../core/validate";

export type IconSelectionStatus = "idle" | "loading";

export interface IconSelectionError {
  readonly reason: IconImageErrorReason;
  readonly fileName: string;
}

export interface IconSelectionController {
  /** 選択から作った、QR に埋め込める絵（なしのときは null） */
  readonly artwork: IconArtwork | null;
  readonly status: IconSelectionStatus;
  readonly error: IconSelectionError | null;
  /** アイコンなしにする（読み込み中なら取り消す） */
  selectNone(): void;
  /** 組込アイコンを選ぶ（読み込み中なら取り消す） */
  selectBuiltin(id: IconId): void;
  /** 画像を選ぶ。実際にデコードしてから親へ通知する */
  selectImage(file: File): void;
  dismissError(): void;
}

/** 選択の「中身」を表す短いキー。読み込み中に親が別の選択へ変えたのを検知するのにも使う */
function selectionKey(selection: IconSelection): string {
  switch (selection.kind) {
    case "none":
      return "none";
    case "builtin":
      return `builtin:${selection.id}`;
    case "image":
      return "image";
  }
}

export function useIconSelection({
  selection,
  onSelect,
}: {
  selection: IconSelection;
  /** 選択が決まったら呼ぶ（状態は親が保持する） */
  onSelect(selection: IconSelection): void;
}): IconSelectionController {
  const [status, setStatus] = useState<IconSelectionStatus>("idle");
  const [error, setError] = useState<IconSelectionError | null>(null);
  const requestRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const onSelectRef = useRef(onSelect);
  const selectionKeyRef = useRef(selectionKey(selection));

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    selectionKeyRef.current = selectionKey(selection);
  }, [selection]);

  /** 進行中の読み込みを取り消し、その結果が後から届いても捨てる */
  const cancelPending = useCallback(() => {
    requestRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  // 画面から外れたら読み込みを止める
  useEffect(() => () => cancelPending(), [cancelPending]);

  const selectNone = useCallback(() => {
    cancelPending();
    setStatus("idle");
    setError(null);
    onSelectRef.current(noIcon());
  }, [cancelPending]);

  const selectBuiltin = useCallback(
    (id: IconId) => {
      cancelPending();
      setStatus("idle");
      setError(null);
      onSelectRef.current(builtinIcon(id));
    },
    [cancelPending],
  );

  const selectImage = useCallback(
    (file: File) => {
      const check = checkIconFile(file);
      if (!check.ok) {
        cancelPending();
        setStatus("idle");
        setError({ reason: check.reason, fileName: file.name });
        return;
      }

      const request = requestRef.current + 1;
      requestRef.current = request;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const startedKey = selectionKeyRef.current;
      setError(null);
      setStatus("loading");

      // 追い越された・親が別の選択へ変えたときの古い結果は捨てる
      const isStale = () =>
        requestRef.current !== request || selectionKeyRef.current !== startedKey;

      decodeIconImage(file, controller.signal).then(
        (result) => {
          if (isStale()) return;
          abortRef.current = null;
          setStatus("idle");
          onSelectRef.current(imageIcon(result.dataUrl, result.width, result.height));
        },
        (reason: unknown) => {
          if (isStale()) return;
          abortRef.current = null;
          setStatus("idle");
          if (reason instanceof IconImageAbortError) return;
          setError({
            reason: reason instanceof IconImageError ? reason.reason : "decode",
            fileName: file.name,
          });
        },
      );
    },
    [cancelPending],
  );

  const dismissError = useCallback(() => setError(null), []);

  const artwork = useMemo(() => artworkForSelection(selection), [selection]);

  return { artwork, status, error, selectNone, selectBuiltin, selectImage, dismissError };
}
