/**
 * markdown-it による MarkdownRenderer の実装（markdown-it とプラグインはここに閉じ込める）。
 *
 * 安全対策（docs/markdown-pdf-plan.md §5）
 * - `html: false`：生の HTML はすべて文字として表示する
 * - validateLink：core の許可リスト（isAllowedUrl）。javascript: 等はリンク・画像にならず文字のまま残る
 * - 画像：core の規則（resolveImageSource）で、data: の画像と一緒に入れた画像（blob:・data:）だけを表示する。
 *   外部 URL・見つからない画像は、代わりの文言を出す（読み込まない）
 * - リンク：ページ内（#…）以外は rel="noopener noreferrer" と target="_blank" を付ける
 *
 * 重い依存は createMarkdownItRenderer() を呼んだときに動的 import する（最初の表示に含めない）。
 */
import type { MarkdownIt, RendererRule } from "markdown-it";
import type { MarkdownRenderer, RenderOptions } from "../core/port";
import { isAllowedUrl, isFragmentLink, resolveImageSource } from "../core/url-policy";

// type にする（interface では markdown-it の Env の索引シグネチャを満たせない）
type RenderEnv = { renderOptions: RenderOptions };

/** 生成済みの markdown-it に、このアプリの規則を設定する */
export function configureMarkdownIt(md: MarkdownIt): MarkdownIt {
  md.validateLink = isAllowedUrl;
  const escapeHtml = md.utils.escapeHtml;

  const renderDefault: RendererRule = (tokens, idx, options, _env, self) =>
    self.renderToken(tokens, idx, options);
  const linkOpen = md.renderer.rules.link_open ?? renderDefault;
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    if (token && !isFragmentLink(String(token.attrGet("href") ?? ""))) {
      token.attrSet("target", "_blank");
      token.attrSet("rel", "noopener noreferrer");
    }
    return linkOpen(tokens, idx, options, env, self);
  };

  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    if (!token) return "";
    const alt = self.renderInlineAsText(token.children ?? [], options, env);
    const renderOptions = (env as RenderEnv | undefined)?.renderOptions;
    const resolution = resolveImageSource(
      String(token.attrGet("src") ?? ""),
      renderOptions?.images ?? new Map(),
    );
    if (resolution.kind === "ok") {
      token.attrSet("src", resolution.src);
      token.attrSet("alt", alt);
      return self.renderToken(tokens, idx, options);
    }
    const label = renderOptions?.blockedImageLabel ?? "";
    const text = alt ? `${label}: ${alt}` : label;
    return `<span class="md-blocked-image" data-reason="${resolution.reason}">${escapeHtml(text)}</span>`;
  };
  return md;
}

export async function createMarkdownItRenderer(): Promise<MarkdownRenderer> {
  const [{ default: markdownIt }, { default: footnote }, { tasklist }] = await Promise.all([
    import("markdown-it"),
    import("markdown-it-footnote"),
    import("@mdit/plugin-tasklist"),
  ]);
  const md = markdownIt({ html: false, linkify: true, typographer: false });
  md.use(footnote).use(tasklist, { disabled: true, label: true });
  configureMarkdownIt(md);
  return {
    render(markdown, renderOptions) {
      const env: RenderEnv = { renderOptions };
      return md.render(markdown, env);
    },
  };
}
