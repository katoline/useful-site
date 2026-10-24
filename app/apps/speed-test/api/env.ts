/** Worker のバインディング（wrangler.jsonc と対応させる） */
export interface Env {
  ASSETS: Fetcher;
  /**
   * 測定 API の回数制限（wrangler.jsonc の ratelimits）。START は測定の開始（/info）、TRANSFER はそれ以外。
   * テスト等バインディングが無い環境では undefined になる（loopback 以外では API を止める）
   */
  SPEED_TEST_START_LIMITER?: RateLimit;
  SPEED_TEST_TRANSFER_LIMITER?: RateLimit;
}
