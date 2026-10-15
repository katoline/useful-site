/**
 * UTF-8 のバイト数を数える（純粋関数）。
 * core では TextEncoder 等のグローバルを使わないため、コードポイントから直接数える。
 * 孤立したサロゲートは U+FFFD と同じ 3 バイトとして数える（TextEncoder と同じ結果）。
 */
export function utf8ByteLength(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) {
      bytes += 1;
    } else if (code < 0x800) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        i++;
      } else {
        bytes += 3;
      }
    } else {
      bytes += 3;
    }
  }
  return bytes;
}
