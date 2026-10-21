import type { ReactNode } from "react";
import { AdSlot } from "../ads/AdSlot";
import type { Lang } from "../i18n";
import { TooltipProvider } from "../ui/tooltip";
import { AppTabs } from "./AppTabs";
import { BottomNoticesProvider } from "./BottomNotices";
import { LangSuggestion } from "./LangSuggestion";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import { ShellPathContext } from "./shell-path";

export interface ShellConfig {
  appPath: string;
  pathname?: string;
  name: Record<Lang, string>;
  menu: { page: string; label: Record<Lang, string> }[];
  footer?: { page: string; label: Record<Lang, string> }[];
  logo?: ReactNode;
  footerExtra?: ReactNode;
  footerLinksExtra?: ReactNode;
  footerNote?: Record<Lang, string>;
}
export function ShellProviders({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={300}>
      <BottomNoticesProvider>{children}</BottomNoticesProvider>
    </TooltipProvider>
  );
}
export function Shell({ children, config }: { children: ReactNode; config: ShellConfig }) {
  return (
    <ShellPathContext.Provider value={{ appPath: config.appPath, pathname: config.pathname }}>
      <SiteHeader config={config} />
      <AppTabs config={config} />
      <div className="mx-auto hidden max-w-6xl px-4 md:block">
        <AdSlot format="banner" />
      </div>
      <main id="main" className="mx-auto w-full max-w-6xl px-4 py-8">
        {children}
      </main>
      <SiteFooter config={config} />
      <LangSuggestion />
    </ShellPathContext.Provider>
  );
}
