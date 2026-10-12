/**
 * 共通レイアウト。<html lang> はページの言語、テーマはインラインスクリプトで描画前に決める。
 * ルートより上（App）に置いた Provider は、言語切り替えのクライアント側遷移でも作り直されない。
 */
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
  useRouteError,
} from "react-router";
import { AdSlot } from "~/components/ads/AdSlot";
import { CloudflareAnalytics } from "~/components/analytics/CloudflareAnalytics";
import { LangSuggestion } from "~/components/layout/LangSuggestion";
import { PageHeader } from "~/components/layout/PageHeader";
import { SiteFooter } from "~/components/layout/SiteFooter";
import { SiteHeader } from "~/components/layout/SiteHeader";
import { PwaRoot } from "~/components/pwa/PwaRoot";
import { TooltipProvider } from "~/components/ui/tooltip";
import { I18nProvider, langFromPathname, translate } from "~/i18n";
import { BASE_PATH } from "~/lib/config";
import { manifestFileName } from "~/lib/pwa";
import { ToolSessionProvider } from "~/state/ToolSessionProvider";
import { THEME_COLORS, THEME_INIT_SCRIPT } from "~/theme/theme";
import "./app.css";

export function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const lang = langFromPathname(pathname);
  return (
    // data-theme はインラインスクリプトが付けるので、ハイドレーションの差分警告を抑える
    <html lang={lang} suppressHydrationWarning>
      <head>
        {/* ちらつき防止：最初に実行してテーマを決める（§8.2）。React は <script> の子をエスケープしない */}
        <script>{THEME_INIT_SCRIPT}</script>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="color-scheme" content="light dark" />
        <meta
          name="theme-color"
          media="(prefers-color-scheme: light)"
          content={THEME_COLORS.light}
        />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content={THEME_COLORS.dark} />
        {/* PWA：表示中の言語のマニフェスト（id は日英共通）とアイコン（§6.1） */}
        <link rel="manifest" href={`${BASE_PATH}/${manifestFileName(lang)}`} />
        <link rel="icon" href={`${BASE_PATH}/favicon.ico`} sizes="32x32" />
        <link rel="icon" href={`${BASE_PATH}/favicon.svg`} type="image/svg+xml" />
        <link rel="apple-touch-icon" href={`${BASE_PATH}/apple-touch-icon.png`} />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
        <CloudflareAnalytics />
      </body>
    </html>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const lang = langFromPathname(pathname);
  return (
    <I18nProvider lang={lang}>
      <TooltipProvider delayDuration={300}>
        <LangSuggestion />
        <SiteHeader />
        {/* ヘッダー直下の横長バナー（PC のみ。§7.2） */}
        <div className="mx-auto hidden max-w-6xl px-4 md:block">
          <AdSlot format="banner" />
        </div>
        <main id="main" className="mx-auto w-full max-w-6xl px-4 py-8">
          {children}
        </main>
        <SiteFooter />
        <PwaRoot />
      </TooltipProvider>
    </I18nProvider>
  );
}

export default function App() {
  return (
    <ToolSessionProvider>
      <Shell>
        <Outlet />
      </Shell>
    </ToolSessionProvider>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const { pathname } = useLocation();
  const lang = langFromPathname(pathname);
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  const detail = import.meta.env.DEV && error instanceof Error ? error.message : "";
  return (
    <ToolSessionProvider>
      <Shell>
        <PageHeader
          title={translate(lang, notFound ? "errors.notFoundTitle" : "errors.genericTitle")}
          lead={translate(lang, notFound ? "errors.notFoundBody" : "errors.genericBody")}
        />
        {detail && <pre className="overflow-x-auto text-sm text-destructive">{detail}</pre>}
      </Shell>
    </ToolSessionProvider>
  );
}
