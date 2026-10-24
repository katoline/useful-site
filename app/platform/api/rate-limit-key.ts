/**
 * 回数制限のキー（CF-Connecting-IP から作る）。
 *
 * - IPv4 はそのまま
 * - IPv6 は `::` を展開して先頭 64 ビット（/64）に丸める。利用者 1 人に /64 が割り当てられるのが
 *   普通なので、フルアドレスをキーにすると送信元アドレスを変えるだけで制限を回避できるため
 * - IPv4-mapped（`::ffff:a.b.c.d` / `::ffff:7f00:1`）は IPv4 として扱う
 * - 解釈できない値・無い値は "unknown"（本番では Cloudflare が必ず付けるので、開発環境だけ）
 *
 * 本番では Workers の Rate Limiting に加えて、WAF のレート制限ルール（IPv6 はプレフィックス単位で
 * 数えられる）の併用も検討する。
 */

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function parseIpv4(value: string): number[] | undefined {
  const m = IPV4_RE.exec(value);
  if (!m) return undefined;
  const octets = m.slice(1).map(Number);
  return octets.every((n) => n <= 255) ? octets : undefined;
}

/** IPv6 を 8 個の 16 ビット値に展開する。末尾の埋め込み IPv4 も受け付ける */
export function expandIpv6(value: string): number[] | undefined {
  let text = value.toLowerCase();
  // ゾーン ID（fe80::1%eth0）は外す
  const zone = text.indexOf("%");
  if (zone >= 0) text = text.slice(0, zone);
  if (text.startsWith("[") && text.endsWith("]")) text = text.slice(1, -1);
  if (!text.includes(":")) return undefined;

  const halves = text.split("::");
  if (halves.length > 2) return undefined;

  const parseGroups = (part: string): number[] | undefined => {
    if (part === "") return [];
    const groups: number[] = [];
    const items = part.split(":");
    for (let i = 0; i < items.length; i++) {
      const item = items[i] ?? "";
      if (i === items.length - 1 && item.includes(".")) {
        const v4 = parseIpv4(item);
        if (!v4) return undefined;
        groups.push(((v4[0] ?? 0) << 8) | (v4[1] ?? 0), ((v4[2] ?? 0) << 8) | (v4[3] ?? 0));
        continue;
      }
      if (!/^[0-9a-f]{1,4}$/.test(item)) return undefined;
      groups.push(Number.parseInt(item, 16));
    }
    return groups;
  };

  const head = parseGroups(halves[0] ?? "");
  const tail = halves.length === 2 ? parseGroups(halves[1] ?? "") : [];
  if (!head || !tail) return undefined;
  if (halves.length === 1) return head.length === 8 ? head : undefined;
  const missing = 8 - head.length - tail.length;
  if (missing < 1) return undefined;
  return [...head, ...new Array<number>(missing).fill(0), ...tail];
}

export function rateLimitKey(ip: string | null | undefined): string {
  const value = (ip ?? "").trim();
  if (value === "") return "unknown";

  const v4 = parseIpv4(value);
  if (v4) return v4.join(".");

  const groups = expandIpv6(value);
  if (!groups) return "unknown";

  // IPv4-mapped（::ffff:0:0/96）は IPv4 として数える
  if (groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff) {
    const hi = groups[6] ?? 0;
    const lo = groups[7] ?? 0;
    return [hi >> 8, hi & 0xff, lo >> 8, lo & 0xff].join(".");
  }

  return `${groups
    .slice(0, 4)
    .map((g) => g.toString(16))
    .join(":")}::/64`;
}
