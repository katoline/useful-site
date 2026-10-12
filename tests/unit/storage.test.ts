import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getItem, getJSON, removeItem, setItem, setJSON, storageKey } from "~/lib/storage";

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, String(v));
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

describe("storage", () => {
  let mem: MemoryStorage;
  beforeEach(() => {
    mem = new MemoryStorage();
    vi.stubGlobal("window", { localStorage: mem });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("キーに image-adjust: を付けて保存する", () => {
    expect(setItem("theme", "dark")).toBe(true);
    expect(mem.data.get("image-adjust:theme")).toBe("dark");
    expect(getItem("theme")).toBe("dark");
    expect(storageKey("lang")).toBe("image-adjust:lang");
    removeItem("theme");
    expect(getItem("theme")).toBeNull();
  });

  it("JSON を読み書きでき、壊れた値は既定値に戻す", () => {
    setJSON("settings", { q: 80 });
    expect(getJSON("settings", null)).toEqual({ q: 80 });
    mem.data.set("image-adjust:broken", "{");
    expect(getJSON("broken", "fallback")).toBe("fallback");
  });

  it("localStorage が例外を投げても落ちない", () => {
    vi.stubGlobal("window", {
      get localStorage(): never {
        throw new Error("SecurityError");
      },
    });
    expect(setItem("theme", "dark")).toBe(false);
    expect(getItem("theme")).toBeNull();
    expect(() => removeItem("theme")).not.toThrow();
  });

  it("window が無い環境（プリレンダリング）でも落ちない", () => {
    vi.unstubAllGlobals();
    expect(getItem("theme")).toBeNull();
    expect(setItem("theme", "dark")).toBe(false);
  });
});
