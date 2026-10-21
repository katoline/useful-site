// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { AppTabs } from "./AppTabs";
import type { ShellConfig } from "./Shell";

afterEach(cleanup);

const config: ShellConfig = {
  appPath: "image-adjust",
  name: { ja: "画像ツール", en: "Image tool" },
  menu: [
    { page: "", label: { ja: "変換・圧縮", en: "Convert & compress" } },
    { page: "icons", label: { ja: "アイコン生成", en: "Icon generator" } },
    { page: "guide", label: { ja: "ガイド", en: "Guides" } },
  ],
};

function renderAt(pathname: string, value: ShellConfig = config) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <AppTabs config={value} />
    </MemoryRouter>,
  );
}

describe("AppTabs", () => {
  it("項目が 2 つ未満のアプリには出さない", () => {
    const { container } = renderAt("/markdown-pdf/", {
      ...config,
      appPath: "markdown-pdf",
      menu: [{ page: "", label: { ja: "変換", en: "Convert" } }],
    });
    expect(container.querySelector("nav")).toBeNull();
  });

  it("アプリのトップでは「変換・圧縮」だけを選択中にする", () => {
    renderAt("/image-adjust/");
    const nav = screen.getByRole("navigation", { name: "このアプリのページ" });
    const current = [...nav.querySelectorAll("[aria-current='page']")].map((el) => el.textContent);
    expect(current).toEqual(["変換・圧縮"]);
  });

  it("ほかのページではトップを選択中にしない", () => {
    renderAt("/image-adjust/icons/");
    const nav = screen.getByRole("navigation", { name: "このアプリのページ" });
    const current = [...nav.querySelectorAll("[aria-current='page']")].map((el) => el.textContent);
    expect(current).toEqual(["アイコン生成"]);
    expect(
      screen.getByRole("link", { name: "変換・圧縮" }).getAttribute("aria-current"),
    ).toBeNull();
  });
});
