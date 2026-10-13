/** ドラッグ＆ドロップでファイルを受け取る */
import { type DragEvent, useCallback, useRef, useState } from "react";

function hasFiles(event: DragEvent): boolean {
  return [...event.dataTransfer.types].includes("Files");
}

export function useFileDrop(onFiles: (files: File[]) => void) {
  const [dragging, setDragging] = useState(false);
  // 子要素への出入りでも dragenter / dragleave が来るので数える
  const depth = useRef(0);
  const onDragEnter = useCallback((event: DragEvent) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    depth.current++;
    setDragging(true);
  }, []);
  const onDragOver = useCallback((event: DragEvent) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);
  const onDragLeave = useCallback(() => {
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setDragging(false);
  }, []);
  const onDrop = useCallback(
    (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth.current = 0;
      setDragging(false);
      onFiles([...event.dataTransfer.files]);
    },
    [onFiles],
  );
  return { dragging, handlers: { onDragEnter, onDragOver, onDragLeave, onDrop } };
}
