/** URL 入力（Worker の中継 API 経由の取得）の失敗の種類。文言は tool.input.urlErrors.<code> */
export type RemoteImageErrorCode =
  | "invalid_url"
  | "forbidden_host"
  | "too_large"
  | "not_image"
  | "timeout"
  | "rate_limited"
  | "upstream_error"
  | "network";
