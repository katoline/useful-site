import { describe, expect, it } from "vitest";
import { expandIpv6, rateLimitKey } from "./rate-limit-key";

describe("rateLimitKey", () => {
  it.each([
    ["203.0.113.5", "203.0.113.5"],
    [" 198.51.100.1 ", "198.51.100.1"],
    // 同じ /64 の別アドレスは同じキー
    ["2001:db8:1:2:3:4:5:6", "2001:db8:1:2::/64"],
    ["2001:db8:1:2:ffff:ffff:ffff:ffff", "2001:db8:1:2::/64"],
    ["2001:0DB8:0001:0002::1", "2001:db8:1:2::/64"],
    ["2001:db8::1", "2001:db8:0:0::/64"],
    ["2001:db8::", "2001:db8:0:0::/64"],
    ["::1", "0:0:0:0::/64"],
    ["[2001:db8:1:2::9]", "2001:db8:1:2::/64"],
    ["fe80::1%eth0", "fe80:0:0:0::/64"],
    // IPv4-mapped は IPv4 として扱う
    ["::ffff:192.0.2.1", "192.0.2.1"],
    ["::FFFF:c000:0201", "192.0.2.1"],
    ["0:0:0:0:0:ffff:192.0.2.1", "192.0.2.1"],
    // 解釈できないもの
    [undefined, "unknown"],
    ["", "unknown"],
    ["not-an-ip", "unknown"],
    ["256.1.1.1", "unknown"],
    ["1:2:3:4:5:6:7:8:9", "unknown"],
    ["1::2::3", "unknown"],
    ["12345::", "unknown"],
  ])("%s → %s", (ip, expected) => {
    expect(rateLimitKey(ip)).toBe(expected);
  });

  it("別の /64 は別のキー", () => {
    expect(rateLimitKey("2001:db8:1:2::1")).not.toBe(rateLimitKey("2001:db8:1:3::1"));
  });

  it("expandIpv6 は :: を展開する", () => {
    expect(expandIpv6("2001:db8::8:1")).toEqual([0x2001, 0xdb8, 0, 0, 0, 0, 8, 1]);
    expect(expandIpv6("::")).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(expandIpv6("1:2:3:4:5:6:7::8")).toBeUndefined();
  });
});
