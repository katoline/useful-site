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
});
