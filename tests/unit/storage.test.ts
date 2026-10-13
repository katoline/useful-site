import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createStorage,
  getItem,
  getJSON,
  removeItem,
  setItem,
  setJSON,
  storageKey,
} from "~/platform/storage";

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

  it("キーに site: を付けて保存する", () => {
    expect(setItem("theme", "dark")).toBe(true);
    expect(mem.data.get("site:theme")).toBe("dark");
    expect(getItem("theme")).toBe("dark");
    expect(storageKey("lang")).toBe("site:lang");
    removeItem("theme");
    expect(getItem("theme")).toBeNull();
  });

  it("アプリごとの接頭辞が独立する", () => {
    const app = createStorage("image-adjust:");
    app.setItem("theme", "light");
    setItem("theme", "dark");
    expect(app.getItem("theme")).toBe("light");
    expect(getItem("theme")).toBe("dark");
  });

  it("JSON を読み書きでき、壊れた値は既定値に戻す", () => {
    setJSON("settings", { q: 80 });
    expect(getJSON("settings", null)).toEqual({ q: 80 });
    mem.data.set("site:broken", "{");
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

  it("session を指定すると sessionStorage に保存する", () => {
    const session = new MemoryStorage();
    vi.stubGlobal("window", { localStorage: mem, sessionStorage: session });
    const app = createStorage("markdown-pdf:", "session");
    expect(app.setItem("draft", "# x")).toBe(true);
    expect(session.data.get("markdown-pdf:draft")).toBe("# x");
    expect(mem.data.size).toBe(0);
    expect(app.getItem("draft")).toBe("# x");
  });

  it("window が無い環境（プリレンダリング）でも落ちない", () => {
    vi.unstubAllGlobals();
    expect(getItem("theme")).toBeNull();
    expect(setItem("theme", "dark")).toBe(false);
  });
});
