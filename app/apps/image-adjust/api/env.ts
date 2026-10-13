/** Worker のバインディング（wrangler.jsonc と対応させる） */
export interface Env {
  ASSETS: Fetcher;
  /**
   * fetch-image の回数制限（wrangler.jsonc の ratelimits）。
   * テスト等バインディングが無い環境では undefined になり、制限をかけない
   */
  FETCH_IMAGE_RATE_LIMITER?: RateLimit;
}
