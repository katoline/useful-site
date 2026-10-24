/** 測定の手順と上限（API と画面の両方が使う） */

/** Ping を送る回数（最初の 1 回は接続の確立を含むので数えない） */
export const PING_COUNT = 20;
/** ダウンロード・アップロードそれぞれの測定時間（ミリ秒） */
export const TRANSFER_DURATION_MS = 8000;
/** 最初のこの時間は速度が上がりきっていないので、結果の計算に使わない（ミリ秒） */
export const WARMUP_MS = 1500;
/** 同時に流す接続の数（1 本だと回線の速さを出し切れないことがある） */
export const PARALLEL_STREAMS = 4;

/** 1 回のリクエストで送受信する大きさ（バイト）。速い回線では倍々に大きくする */
export const INITIAL_CHUNK_BYTES = 256 * 1024;
export const MAX_DOWNLOAD_BYTES = 64 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = 32 * 1024 * 1024;
/** 1 回のリクエストがこれより早く終わったら、次は大きくする（ミリ秒） */
export const GROW_BELOW_MS = 1000;

/** 結果の履歴を残す件数 */
export const HISTORY_LIMIT = 10;
