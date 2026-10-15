/**
 * 生成済み SVG を Image → Canvas 経由で PNG にする（DOM / Canvas はここに閉じ込める）。
 * SVG を読み込むための blob: URL は読み込み後に必ず解放する。返すのは Blob だけなので、
 * 表示に使う blob: URL は呼び出し側が作って解放する（`createObjectUrl` / `releaseObjectUrl`）。
 */
import { type PngSize, QR_BACKGROUND_COLOR } from "../../../domain/qr-settings";

const SVG_MIME = "image/svg+xml;charset=utf-8";

interface LoadedImage {
  image: HTMLImageElement;
  /** 読み込みに使った blob: URL（呼び出し側で解放する） */
  objectUrl: string;
}

function loadSvgImage(svg: string): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(new Blob([svg], { type: SVG_MIME }));
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve({ image, objectUrl });
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("SVG を画像として読み込めませんでした"));
    };
    image.src = objectUrl;
  });
}

/** SVG 文字列を指定サイズの PNG Blob にする */
export async function renderPngBlob(svg: string, size: PngSize): Promise<Blob> {
  const { image, objectUrl } = await loadSvgImage(svg);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas を利用できません");
    context.fillStyle = QR_BACKGROUND_COLOR;
    context.fillRect(0, 0, size, size);
    context.drawImage(image, 0, 0, size, size);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("PNG を作成できませんでした"));
      }, "image/png");
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** SVG 文字列を指定サイズの PNG data URL にする（プレビュー・受け渡し用） */
export async function renderPngDataUrl(svg: string, size: PngSize): Promise<string> {
  const blob = await renderPngBlob(svg, size);
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("PNG を data URL にできませんでした"));
    reader.onerror = () => reject(new Error("PNG を data URL にできませんでした"));
    reader.readAsDataURL(blob);
  });
}
