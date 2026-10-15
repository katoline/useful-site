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
import { AdSenseScript } from "~/platform/ads/AdSenseScript";
import { CloudflareAnalytics } from "~/platform/analytics/CloudflareAnalytics";
import { SITE_NAME } from "~/platform/config";
import { I18nProvider, langFromPathname, translate } from "~/platform/i18n";
import { PageHeader } from "~/platform/shell/PageHeader";
import { POINTER_ACTIVITY_SCRIPT } from "~/platform/shell/pointer-activity";
import { Shell, ShellProviders } from "~/platform/shell/Shell";
import { ToolSessionProvider } from "~/platform/state/ToolSessionProvider";
import { THEME_COLORS, THEME_INIT_SCRIPT } from "~/platform/theme/theme";
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
        {/* ハイドレーション前の pointerdown を拾う（画面下の通知の初回表示を操作中に出さないため） */}
        <script>{POINTER_ACTIVITY_SCRIPT}</script>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="color-scheme" content="light dark" />
        <meta
          name="theme-color"
          media="(prefers-color-scheme: light)"
          content={THEME_COLORS.light}
        />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content={THEME_COLORS.dark} />
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
        <CloudflareAnalytics />
        <AdSenseScript />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <ToolSessionProvider>
      <I18nProvider lang={langFromPathname(useLocation().pathname)}>
        <ShellProviders>
          <Outlet />
        </ShellProviders>
      </I18nProvider>
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
      <I18nProvider lang={lang}>
        <ShellProviders>
          <Shell config={{ appPath: "", name: SITE_NAME, menu: [] }}>
            <PageHeader
              title={translate(lang, notFound ? "errors.notFoundTitle" : "errors.genericTitle")}
              lead={translate(lang, notFound ? "errors.notFoundBody" : "errors.genericBody")}
            />
            {detail && <pre className="overflow-x-auto text-sm text-destructive">{detail}</pre>}
          </Shell>
        </ShellProviders>
      </I18nProvider>
    </ToolSessionProvider>
  );
}
