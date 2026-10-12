/**
 * 判定器が決めきれない（need_more を返し続ける）場合でも、fetch-image のループが
 * TEXT_SNIFF_BYTES＋1 チャンク程度で読み取りをやめることの確認（判定器の実装によらない安全弁）
 */
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { API_BASE_PATH, SITE_ORIGIN } from "../../app/lib/config";
import type { Env } from "../env";
import { createFetchImageRoute, MAX_SNIFF_BUFFER_BYTES } from "./fetch-image";

vi.mock("../lib/image-sniff", async (importOriginal) => {
  const original = await importOriginal<typeof import("../lib/image-sniff")>();
  return { ...original, sniffImage: () => ({ kind: "need_more" }) };
});

describe("fetch-image の判定バッファの安全弁", () => {
  it("判定が付かないまま読み続けず、not_image で打ち切って上流を cancel する", async () => {
    let pulled = 0;
    const cancel = vi.fn();
    const chunk = new Uint8Array(4096);
    const fetchMock = vi.fn<typeof fetch>(
      async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            pull(controller) {
              pulled += chunk.byteLength;
              controller.enqueue(chunk);
            },
            cancel,
          }),
          { headers: { "Content-Type": "image/svg+xml" } },
        ),
    );
    const app = new Hono<{ Bindings: Env }>()
      .basePath(API_BASE_PATH)
      .route("/fetch-image", createFetchImageRoute({ fetch: fetchMock }));
    const res = await app.request(
      `${SITE_ORIGIN}${API_BASE_PATH}/fetch-image?url=${encodeURIComponent("https://cdn.example.com/x.svg")}`,
      { headers: { "Sec-Fetch-Site": "same-origin" } },
      {} as Env,
    );
    expect(res.status).toBe(415);
    expect(((await res.json()) as { error: string }).error).toBe("not_image");
    expect(cancel).toHaveBeenCalled();
    // 上流のストリームは先読み（highWaterMark）分だけ多く引かれることがあるので数チャンクの余裕を見る
    expect(pulled).toBeLessThanOrEqual(MAX_SNIFF_BUFFER_BYTES + 4 * chunk.byteLength);
  });
});
