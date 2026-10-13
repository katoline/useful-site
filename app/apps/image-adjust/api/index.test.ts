import { describe, expect, it } from "vitest";
import type { Env } from "../../../../worker/env";
import worker from "../../../../worker/index";

const env = {
  ASSETS: { fetch: async () => new Response("asset") },
} as unknown as Env;
const ctx = {} as ExecutionContext;

describe("worker", () => {
  it("/image-adjust/api/health が応答する", async () => {
    const res = await worker.fetch(
      new Request("http://localhost/image-adjust/api/health") as Request<
        unknown,
        IncomingRequestCfProperties
      >,
      env,
      ctx,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("API 以外は静的アセットへ渡す", async () => {
    const res = await worker.fetch(
      new Request("http://localhost/image-adjust/about/") as Request<
        unknown,
        IncomingRequestCfProperties
      >,
      env,
      ctx,
    );
    expect(await res.text()).toBe("asset");
  });

  it("未定義の API は JSON の 404", async () => {
    const res = await worker.fetch(
      new Request("http://localhost/image-adjust/api/nope") as Request<
        unknown,
        IncomingRequestCfProperties
      >,
      env,
      ctx,
    );
    expect(res.status).toBe(404);
  });
});
