import { describe, expect, it } from "vitest";
import { analyzeBoundaries, checkBoundaries } from "../../scripts/check-boundaries";

const ROOT = "/repo";
const messages = (file: string, source: string) =>
  analyzeBoundaries(file, source, ROOT).map((issue) => issue.message);

describe("依存の境界（scripts/check-boundaries.ts）", () => {
  it("リポジトリ全体に違反が無い", () => {
    expect(checkBoundaries()).toEqual([]);
  });

  it("他のアプリを import できない", () => {
    expect(
      messages("app/apps/a/pages/tool/x.tsx", 'import { b } from "~/apps/b/manifest";'),
    ).toEqual([expect.stringContaining("他のアプリへの依存")]);
  });

  it("feature 同士は import できない", () => {
    expect(messages("app/apps/a/features/one/ui/X.tsx", 'import { y } from "../../two";')).toEqual([
      expect.stringContaining("別の feature への依存"),
    ]);
    expect(messages("app/apps/a/features/one/ui/X.tsx", 'import { y } from "../core/y";')).toEqual(
      [],
    );
    expect(
      messages("app/apps/a/features/one/ui/X.tsx", 'import { y } from "../../two/index";'),
    ).toEqual([expect.stringContaining("別の feature への依存")]);
  });

  it("feature の外からは index だけを import できる", () => {
    const page = "app/apps/a/pages/tool/Page.tsx";
    expect(messages(page, 'import { x } from "../../features/one";')).toEqual([]);
    expect(messages(page, 'import { x } from "../../features/one/index";')).toEqual([]);
    expect(messages(page, 'import { x } from "../../features/one/core/x";')).toEqual([
      expect.stringContaining("feature の外から内部ファイルへの依存"),
    ]);
  });

  it("page 同士は import できない", () => {
    expect(
      messages("app/apps/a/pages/tool/Page.tsx", 'import { x } from "../other/Page";'),
    ).toEqual([expect.stringContaining("別のページへの依存")]);
  });

  describe("core", () => {
    const core = "app/apps/a/features/one/core/x.ts";

    it("自分の core と domain だけを import できる", () => {
      expect(messages(core, 'import { y } from "./y";')).toEqual([]);
      expect(messages(core, 'import { d } from "../../../domain/limits";')).toEqual([]);
      for (const spec of ["../adapters/a", "../ui/U", "markdown-it", "~/platform/storage"]) {
        expect(messages(core, `import { z } from "${spec}";`), spec).toEqual([
          expect.stringContaining("core は自分の core と domain だけ"),
        ]);
      }
    });

    it("DOM の型とグローバルを使えない", () => {
      expect(messages(core, "export const f = (e: HTMLElement) => e;")).toEqual([
        expect.stringContaining("DOM の型"),
      ]);
      for (const source of [
        "export const x = document.title;",
        'export const x = () => sessionStorage.getItem("k");',
        "export const x = () => window.print();",
        "export const x = typeof navigator;",
        "export const x = { document };",
      ]) {
        expect(messages(core, source), source).toEqual([
          expect.stringContaining("DOM のグローバル"),
        ]);
      }
    });

    it("同名のプロパティ・ローカル変数・引数は DOM のグローバルとみなさない", () => {
      for (const source of [
        "export const x = (o: { document: string }) => o.document;",
        "export const x = { window: 1, print() {} };",
        "export function f(name: string, location = 1) { return name + location; }",
        "export const x = () => { const document = 1; return document; };",
        "export const x = ({ status }: { status: number }) => status;",
      ]) {
        expect(messages(core, source), source).toEqual([]);
      }
    });

    it("core の外（adapters）では DOM を使える", () => {
      expect(
        messages("app/apps/a/features/one/adapters/x.ts", "export const x = document.title;"),
      ).toEqual([]);
    });
  });

  it("環境を問わない標準 API は domain・core で使える", () => {
    const source =
      'new TextDecoder(); new TextEncoder(); new URL("https://example.com"); new URLSearchParams(); setTimeout(() => {}, 0); clearTimeout(1); setInterval(() => {}, 0); clearInterval(1); queueMicrotask(() => {}); structuredClone({}); atob("YQ=="); btoa("a"); console.log(); new AbortController(); AbortSignal.abort(); new Blob(); crypto.getRandomValues(new Uint8Array(1)); type A = Blob; type B = AbortSignal;';
    for (const file of ["app/apps/a/domain/x.ts", "app/apps/a/features/one/core/x.ts"]) {
      expect(messages(file, source)).toEqual([]);
      for (const name of [
        "window",
        "document",
        "navigator",
        "localStorage",
        "sessionStorage",
        "location",
      ]) {
        expect(messages(file, `export const value = ${name};`)).toEqual([
          expect.stringContaining("DOM のグローバル"),
        ]);
      }
    }
  });

  describe("shared", () => {
    const shared = "app/apps/a/shared/x.ts";

    it("features・pages に依存できない", () => {
      for (const spec of ["../features/one", "~/apps/a/pages/tool/Page"]) {
        expect(messages(shared, `import { y } from "${spec}";`), spec).toEqual([
          expect.stringContaining("shared は features・pages に依存できません"),
        ]);
      }
    });

    it("domain・shared・platform・npm は import できる", () => {
      for (const spec of ["../domain/limits", "./y", "~/platform/storage", "zod"]) {
        expect(messages(shared, `import { y } from "${spec}";`), spec).toEqual([]);
      }
    });

    it("shared は DOM を使える", () => {
      expect(messages(shared, "export const x = document.title;")).toEqual([]);
    });
  });

  describe("domain", () => {
    const domain = "app/apps/a/domain/x.ts";

    it("自分の domain と型だけの import を許す", () => {
      expect(messages(domain, 'import { y } from "./y";')).toEqual([]);
      expect(messages(domain, 'import type { Y } from "zod";')).toEqual([]);
      expect(messages(domain, 'export type { Y } from "~/platform/types";')).toEqual([]);
      expect(messages(domain, 'type Y = import("zod").Y;')).toEqual([]);
    });

    it("指定子ごとの type は実行時の依存として扱う", () => {
      for (const source of [
        'import { type Y } from "~/platform/types";',
        'export { type Y } from "zod";',
      ]) {
        expect(messages(domain, source)).toEqual([
          expect.stringContaining("domain は自分の domain"),
        ]);
      }
    });

    it("npm・platform・shared・features・pages の値を import できない", () => {
      for (const spec of [
        "zod",
        "~/platform/storage",
        "../shared/device",
        "../features/one",
        "../pages/tool/Page",
      ]) {
        expect(messages(domain, `import { z } from "${spec}";`), spec).toEqual([
          expect.stringContaining("domain は自分の domain と型だけの import 以外"),
        ]);
      }
      expect(messages(domain, 'import { type Y, z } from "zod";')).toEqual([
        expect.stringContaining("domain は自分の domain"),
      ]);
    });

    it("DOM の型とグローバルを使えない", () => {
      expect(messages(domain, "export const f = (e: HTMLElement) => e;")).toEqual([
        expect.stringContaining("DOM の型"),
      ]);
      expect(messages(domain, "export const x = () => typeof navigator;")).toEqual([
        expect.stringContaining("DOM のグローバル"),
      ]);
    });
  });
});
