/** remote-image：URL 入力（Worker の中継 API 経由の取得とファイル名の決定）（feature の外からはここだけを import する） */
import { fetchRemoteImage, remoteImageErrorCode } from "./adapters/remote-image";

/** 変換・圧縮ツールの URL 入力に注入する実装（ページで組み合わせる） */
export const remoteImageLoader = {
  load: (url: string) => fetchRemoteImage(url),
  errorCode: remoteImageErrorCode,
};
