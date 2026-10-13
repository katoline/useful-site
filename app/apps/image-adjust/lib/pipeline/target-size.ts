/**
 * 目標ファイルサイズの探索（§2.2）。品質（整数のレベル）を二分探索し、
 * 目標以下で最も高い品質を採用する。届かない場合は最小レベルの結果を返し reached=false にする。
 */

export interface SearchOptions {
  min?: number;
  max?: number;
  /** エンコード回数の上限（二分探索なら 100 段階で 7 回） */
  maxAttempts?: number;
}

export interface SearchResult {
  bytes: ArrayBuffer;
  level: number;
  reached: boolean;
  attempts: number;
}

export async function searchTargetSize(
  encodeAt: (level: number) => Promise<ArrayBuffer>,
  targetBytes: number,
  options: SearchOptions = {},
): Promise<SearchResult> {
  const min = options.min ?? 1;
  const max = options.max ?? 100;
  const maxAttempts = options.maxAttempts ?? 8;
  const cache = new Map<number, ArrayBuffer>();
  let attempts = 0;
  const tryLevel = async (level: number) => {
    const hit = cache.get(level);
    if (hit) return hit;
    attempts++;
    const out = await encodeAt(level);
    cache.set(level, out);
    return out;
  };

  let lo = min;
  let hi = max;
  let best: { bytes: ArrayBuffer; level: number } | null = null;
  while (lo <= hi && attempts < maxAttempts) {
    const mid = Math.floor((lo + hi) / 2);
    const out = await tryLevel(mid);
    if (out.byteLength <= targetBytes) {
      best = { bytes: out, level: mid };
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (best) return { ...best, reached: true, attempts };

  // 届かない：最小レベルの結果を出す
  const lowest = await tryLevel(min);
  return { bytes: lowest, level: min, reached: lowest.byteLength <= targetBytes, attempts };
}
