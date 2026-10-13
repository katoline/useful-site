// @vitest-environment happy-dom
/** markdown-it の実装（adapters）の単体テスト。出力を DOM として読んで確かめる */
import { beforeAll, describe, expect, it } from "vitest";
import { createMarkdownItRenderer, type MarkdownRenderer } from "../features/render";

let renderer: MarkdownRenderer;
beforeAll(async () => {
  renderer = await createMarkdownItRenderer();
});

function render(markdown: string, images: ReadonlyMap<string, string> = new Map()) {
  const html = renderer.render(markdown, { images, blockedImageLabel: "画像を表示できません" });
  const container = document.createElement("div");
  container.innerHTML = html;
  return { html, container };
}

describe("生の HTML はエスケープする", () => {
  it("<script> や <img onerror> は要素にならず文字として出る", () => {
    const { html, container } = render(
      '<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">\n\n段落の中の <b onclick="x()">b</b>',
    );
    expect(container.querySelector("script, img, b")).toBeNull();
    expect(container.querySelectorAll("[onerror], [onclick]")).toHaveLength(0);
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(container.textContent).toContain('<img src=x onerror="alert(1)">');
  });

  it("コードブロックの中の HTML もエスケープする", () => {
    const { container } = render("```html\n<script>alert(1)</script>\n```");
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("pre code")?.textContent).toBe("<script>alert(1)</script>\n");
  });
});

describe("危険な URL はリンク・画像にしない", () => {
  it.each([
    "javascript:alert(1)",
    "JAVASCRIPT:alert(1)",
    "javascript&#58;alert(1)",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
  ])("[x](%s) はリンクにならない", (url) => {
    const { container } = render(`[x](${url}) <${url}>`);
    expect(container.querySelector("a")).toBeNull();
  });

  it("http(s)・mailto のリンクは rel と target を付けて出す。ページ内リンクには付けない", () => {
    const { container } = render(
      "[a](https://example.com/) https://example.org/ [m](mailto:a@example.com) [in](#sec)",
    );
    const links = [...container.querySelectorAll("a")];
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "https://example.com/",
      "https://example.org/",
      "mailto:a@example.com",
      "#sec",
    ]);
    for (const a of links.slice(0, 3)) {
      expect(a.getAttribute("rel")).toBe("noopener noreferrer");
      expect(a.getAttribute("target")).toBe("_blank");
    }
    expect(links[3]?.hasAttribute("target")).toBe(false);
  });
});

describe("画像", () => {
  it("外部 URL の画像は読み込まず、代わりの文言を出す", () => {
    const { container } = render(
      "![外部](https://example.com/a.png) ![相対外部](//example.com/b.png) ![無い](missing.png)",
    );
    expect(container.querySelector("img")).toBeNull();
    const blocked = [...container.querySelectorAll(".md-blocked-image")];
    expect(blocked.map((el) => el.getAttribute("data-reason"))).toEqual([
      "external",
      "external",
      "missing",
    ]);
    expect(blocked[0]?.textContent).toBe("画像を表示できません: 外部");
  });

  it("相対パスは一緒に入れた画像の blob: URL に、data: の画像はそのまま出す", () => {
    const { container } = render(
      "![写真](./img/photo.png) ![点](data:image/png;base64,iVBORw0KGgo=)",
      new Map([["photo.png", "blob:http://localhost/abc"]]),
    );
    const images = [...container.querySelectorAll("img")];
    expect(images.map((img) => img.getAttribute("src"))).toEqual([
      "blob:http://localhost/abc",
      "data:image/png;base64,iVBORw0KGgo=",
    ]);
    expect(images[0]?.getAttribute("alt")).toBe("写真");
  });

  it("javascript: の画像は画像にならない", () => {
    const { container } = render("![x](javascript:alert(1))");
    expect(container.querySelector("img, .md-blocked-image")).toBeNull();
  });
});

describe("記法", () => {
  it("表・取り消し線・自動リンクが出る", () => {
    const { container } = render("| A | B |\n| --- | ---: |\n| 1 | 2 |\n\n~~消す~~");
    expect(container.querySelectorAll("table thead th")).toHaveLength(2);
    expect(container.querySelector("table tbody td")?.textContent).toBe("1");
    expect(container.querySelector("s")?.textContent).toBe("消す");
  });

  it("脚注が出る", () => {
    const { container } = render("本文[^1]。\n\n[^1]: 脚注です。");
    expect(container.querySelector("sup.footnote-ref a")?.getAttribute("href")).toBe("#fn1");
    expect(container.querySelector("section.footnotes li#fn1")?.textContent).toContain(
      "脚注です。",
    );
    expect(container.querySelector("hr.footnotes-sep")).not.toBeNull();
  });

  it("タスクリストが無効化されたチェックボックスで出る", () => {
    const { container } = render("- [x] 済み\n- [ ] まだ\n- ふつう");
    const boxes = [...container.querySelectorAll<HTMLInputElement>("input[type=checkbox]")];
    expect(boxes).toHaveLength(2);
    expect(boxes.map((box) => box.hasAttribute("checked"))).toEqual([true, false]);
    expect(boxes.every((box) => box.hasAttribute("disabled"))).toBe(true);
    expect(container.querySelector("ul")?.classList.contains("task-list-container")).toBe(true);
    expect(container.querySelector("li.task-list-item label")?.textContent).toContain("済み");
  });
});
