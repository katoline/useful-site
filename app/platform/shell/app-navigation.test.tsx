// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from "@testing-library/react";
import type { MouseEvent } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { handleAppNavigation } from "./app-navigation";
import type { ShellConfig } from "./Shell";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function controlPage(controller: object | null) {
  vi.stubGlobal(
    "navigator",
    Object.create(navigator, { serviceWorker: { value: { controller } } }),
  );
  return vi.spyOn(window.location, "assign").mockImplementation(() => {});
}

function clickEvent(path: string, overrides: Partial<MouseEvent<HTMLAnchorElement>> = {}) {
  const anchor = document.createElement("a");
  anchor.href = `https://tools.example${path}`;
  return {
    currentTarget: anchor,
    button: 0,
    defaultPrevented: false,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    preventDefault: vi.fn(),
    ...overrides,
  } as unknown as MouseEvent<HTMLAnchorElement>;
}

describe("アプリ外への遷移", () => {
  it("SW が制御しているときは既定の遷移を止めてドキュメントを開く", () => {
    const assign = controlPage({});
    const event = clickEvent("/privacy/#external-transmission");
    handleAppNavigation(event, "image-adjust");
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(assign).toHaveBeenCalledWith(event.currentTarget.href);
  });

  it.each([null, undefined])(
    "SW の制御が無ければクライアント側の遷移を維持する: %s",
    (controller) => {
      const assign = controlPage(controller ?? null);
      if (controller === undefined) vi.stubGlobal("navigator", {});
      const event = clickEvent("/markdown-pdf/");
      handleAppNavigation(event, "image-adjust");
      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(assign).not.toHaveBeenCalled();
    },
  );

  it.each(["/image-adjust", "/image-adjust/", "/image-adjust/en/icons/"])(
    "同じアプリ内の %s はクライアント側の遷移を維持する",
    (path) => {
      const assign = controlPage({});
      const event = clickEvent(path);
      handleAppNavigation(event, "image-adjust");
      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(assign).not.toHaveBeenCalled();
    },
  );

  it("アプリ名の前方一致だけでは内部と判定しない", () => {
    const assign = controlPage({});
    handleAppNavigation(clickEvent("/image-adjust-other/"), "image-adjust");
    expect(assign).toHaveBeenCalledOnce();
  });

  it.each(["/", "/en/"])("ポータルの %s は内部として扱う", (path) => {
    const assign = controlPage({});
    handleAppNavigation(clickEvent(path), "");
    expect(assign).not.toHaveBeenCalled();
    handleAppNavigation(clickEvent("/terms/"), "");
    expect(assign).toHaveBeenCalledOnce();
  });

  it.each([
    { button: 1 },
    { button: 2 },
    { metaKey: true },
    { ctrlKey: true },
    { shiftKey: true },
    { altKey: true },
    { defaultPrevented: true },
  ])("既定の動作や先行するハンドラーを尊重する: %j", (overrides) => {
    const assign = controlPage({});
    const event = clickEvent("/", overrides);
    handleAppNavigation(event, "image-adjust");
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });

  it.each(["_blank", "_self", ""])("target=%s の指定があれば既定の動作に任せる", (target) => {
    const assign = controlPage({});
    const event = clickEvent("/");
    event.currentTarget.setAttribute("target", target);
    handleAppNavigation(event, "image-adjust");
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });
});

describe("Shell のアプリ間リンク", () => {
  const config: ShellConfig = {
    appPath: "image-adjust",
    name: { ja: "画像ツール", en: "Image tool" },
    menu: [],
  };

  it("ヘッダーのサイト名・アプリ一覧・規約類でドキュメントの遷移を使う", () => {
    const assign = controlPage({});
    const view = render(
      <MemoryRouter initialEntries={["/image-adjust/"]}>
        <SiteHeader config={config} />
      </MemoryRouter>,
    );
    fireEvent.click(view.getByTestId("site-home"));
    expect(assign).toHaveBeenCalledOnce();

    fireEvent.click(view.getByTestId("mobile-menu-button"));
    const menu = view.getByRole("dialog");
    const destinations = [...menu.querySelectorAll<HTMLAnchorElement>("a[href]")]
      .filter((anchor) => !new URL(anchor.href).pathname.startsWith("/image-adjust/"))
      .map((anchor) => anchor.href);
    expect(destinations.length).toBeGreaterThanOrEqual(4);
    for (const [index, href] of destinations.entries()) {
      // リンクを押すたびメニューが閉じるので、次の確認前に開き直す
      if (index > 0) fireEvent.click(view.getByTestId("mobile-menu-button"));
      const anchor = [...view.getByRole("dialog").querySelectorAll<HTMLAnchorElement>("a")].find(
        (link) => link.href === href,
      );
      expect(anchor).toBeDefined();
      if (!anchor) throw new Error("メニューのリンクがありません");
      fireEvent.click(anchor);
      expect(assign).toHaveBeenLastCalledWith(href);
      expect(view.queryByRole("dialog")).toBeNull();
    }
    expect(assign).toHaveBeenCalledTimes(destinations.length + 1);
  });

  it("フッターの規約類と外部送信についてでドキュメントの遷移を使う", () => {
    const assign = controlPage({});
    const view = render(
      <MemoryRouter initialEntries={["/image-adjust/"]}>
        <SiteFooter config={config} />
      </MemoryRouter>,
    );
    const links = [...view.container.querySelectorAll<HTMLAnchorElement>("a")];
    expect(links).toHaveLength(3);
    for (const anchor of links) {
      fireEvent.click(anchor);
      expect(assign).toHaveBeenLastCalledWith(anchor.href);
    }
    expect(assign).toHaveBeenCalledTimes(3);
  });
});
