/**
 * 測定 API（/speed-test/api/*）との通信。
 * - Ping：fetch の往復を Resource Timing（requestStart → responseStart）で測る。取れなければ前後の時刻の差
 * - ダウンロード：fetch の本文を読みながら数える。PARALLEL_STREAMS 本を同時に流す
 * - アップロード：fetch では送った量が分からないので、XMLHttpRequest の upload.onprogress で数える
 * どちらも 1 回の大きさを、すぐ終わるなら倍々に大きくする（速い回線でもリクエストの往復で遅く見せない）。
 * 転送中の一時的な通信エラーは、同じ接続で MAX_RETRIES 回まで続けてやり直す（回数制限のエラーはすぐ止める）
 */
import {
  GROW_BELOW_MS,
  INITIAL_CHUNK_BYTES,
  MAX_DOWNLOAD_BYTES,
  MAX_UPLOAD_BYTES,
  PARALLEL_STREAMS,
} from "../../../domain/limits";
import type { ServerInfo } from "../../../domain/measurement";
import { SpeedTestError, type SpeedTestTransport } from "../core/port";

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function failure(status: number): SpeedTestError {
  return new SpeedTestError(status === 429 ? "rate-limited" : "server");
}

function nonce(): string {
  return Math.random().toString(36).slice(2);
}

/** 期限が来るか、外から止められたら abort するシグナル */
function deadlineSignal(
  durationMs: number,
  outer: AbortSignal,
): { signal: AbortSignal; done: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), durationMs);
  const onAbort = () => controller.abort();
  outer.addEventListener("abort", onAbort, { once: true });
  return {
    signal: controller.signal,
    done: () => {
      clearTimeout(timer);
      outer.removeEventListener("abort", onAbort);
    },
  };
}

/** 転送中の一時的な通信エラーを、1 本の接続で続けて何回までやり直すか */
const MAX_RETRIES = 2;

/** 期限まで step を繰り返す。一時的な通信エラーは MAX_RETRIES 回まで続けてやり直す */
async function repeatUntil(deadline: AbortSignal, step: () => Promise<void>): Promise<void> {
  let failures = 0;
  while (!deadline.aborted) {
    try {
      await step();
      failures = 0;
    } catch (error) {
      if (deadline.aborted || !(error instanceof SpeedTestError) || error.kind !== "network")
        throw error;
      failures++;
      if (failures > MAX_RETRIES) throw error;
    }
  }
}

function grow(size: number, elapsedMs: number, max: number): number {
  return elapsedMs < GROW_BELOW_MS ? Math.min(max, size * 2) : size;
}

/** 乱数の 1MiB（getRandomValues は 1 回 65536 バイトまで）。アップロードの本文に使い回す */
let uploadBlock: Uint8Array<ArrayBuffer> | undefined;
function randomBlock(): Uint8Array<ArrayBuffer> {
  if (!uploadBlock) {
    uploadBlock = new Uint8Array(1024 * 1024);
    for (let offset = 0; offset < uploadBlock.byteLength; offset += 65536) {
      crypto.getRandomValues(uploadBlock.subarray(offset, offset + 65536));
    }
  }
  return uploadBlock;
}

function uploadBody(bytes: number): Blob {
  const block = randomBlock();
  const parts: BlobPart[] = [];
  for (let left = bytes; left > 0; left -= block.byteLength) {
    parts.push(left >= block.byteLength ? block : block.subarray(0, left));
  }
  return new Blob(parts, { type: "application/octet-stream" });
}

function xhrUpload(
  url: string,
  body: Blob,
  onBytes: (bytes: number) => void,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let sent = 0;
    const report = (loaded: number) => {
      if (loaded > sent) {
        onBytes(loaded - sent);
        sent = loaded;
      }
    };
    xhr.upload.onprogress = (event) => report(event.loaded);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        report(body.size);
        resolve();
      } else reject(failure(xhr.status));
    };
    xhr.onerror = () => reject(new SpeedTestError("network"));
    xhr.onabort = () => reject(new DOMException("aborted", "AbortError"));
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.open("POST", url);
    xhr.send(body);
  });
}

export function createHttpTransport(apiBase: string): SpeedTestTransport {
  const url = (path: string) => `${apiBase}/${path}`;

  async function request(path: string, signal: AbortSignal): Promise<Response> {
    let response: Response;
    try {
      response = await fetch(url(path), { cache: "no-store", signal });
    } catch (error) {
      if (isAbort(error)) throw error;
      throw new SpeedTestError("network", { cause: error });
    }
    if (!response.ok) throw failure(response.status);
    return response;
  }

  /** 期限まで流し続ける。期限で止めたものは正常の終わりとして扱う */
  async function untilDeadline(
    durationMs: number,
    signal: AbortSignal,
    stream: (deadline: AbortSignal) => Promise<void>,
  ): Promise<void> {
    const deadline = deadlineSignal(durationMs, signal);
    try {
      await Promise.all(
        Array.from({ length: PARALLEL_STREAMS }, async () => {
          try {
            await stream(deadline.signal);
          } catch (error) {
            if (!deadline.signal.aborted || !isAbort(error)) throw error;
          }
        }),
      );
    } finally {
      deadline.done();
    }
    if (signal.aborted) throw new DOMException("aborted", "AbortError");
  }

  return {
    async info(signal) {
      const response = await request("info", signal);
      const data = (await response.json()) as Partial<ServerInfo>;
      return { colo: data.colo ?? null, country: data.country ?? null, isp: data.isp ?? null };
    },

    async ping(signal) {
      const target = url(`ping?r=${nonce()}`);
      const started = performance.now();
      let response: Response;
      try {
        response = await fetch(target, { cache: "no-store", signal });
      } catch (error) {
        if (isAbort(error)) throw error;
        throw new SpeedTestError("network", { cause: error });
      }
      const elapsed = performance.now() - started;
      if (!response.ok) throw failure(response.status);
      const entry = performance
        .getEntriesByName(new URL(target, location.href).href, "resource")
        .at(-1) as PerformanceResourceTiming | undefined;
      const timed = entry && entry.responseStart > 0 ? entry.responseStart - entry.requestStart : 0;
      return timed > 0 ? timed : elapsed;
    },

    download(durationMs, onBytes, signal) {
      return untilDeadline(durationMs, signal, async (deadline) => {
        let size = INITIAL_CHUNK_BYTES;
        await repeatUntil(deadline, async () => {
          const started = performance.now();
          const response = await request(`down?bytes=${size}&r=${nonce()}`, deadline);
          const reader = response.body?.getReader();
          if (!reader) throw new SpeedTestError("server");
          try {
            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              onBytes(value.byteLength);
            }
          } catch (error) {
            if (isAbort(error)) throw error;
            throw new SpeedTestError("network", { cause: error });
          }
          size = grow(size, performance.now() - started, MAX_DOWNLOAD_BYTES);
        });
      });
    },

    upload(durationMs, onBytes, signal) {
      return untilDeadline(durationMs, signal, async (deadline) => {
        let size = INITIAL_CHUNK_BYTES;
        await repeatUntil(deadline, async () => {
          const started = performance.now();
          await xhrUpload(url(`up?r=${nonce()}`), uploadBody(size), onBytes, deadline);
          size = grow(size, performance.now() - started, MAX_UPLOAD_BYTES);
        });
      });
    },
  };
}
