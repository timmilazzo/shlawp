import { configureTracking } from "@agent-native/core/client/analytics";
import { appPath } from "@agent-native/core/client/api-path";
import { useDbSync } from "@agent-native/core/client/hooks";
import {
  AppProviders,
  createAgentNativeQueryClient,
} from "@agent-native/core/client/hooks";
import { getLocaleInitScript, useT } from "@agent-native/core/client/i18n";
import {
  CommandMenu,
  useCommandMenuShortcut,
} from "@agent-native/core/client/navigation";
import { getThemeInitScript } from "@agent-native/core/client/ui";
import { IconHierarchy2, IconSun, IconMoon } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useState } from "react";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
  useNavigate,
} from "react-router";
import type { LinksFunction } from "react-router";

import { Layout as AppLayout } from "@/components/layout/Layout";
import { AppToolkitProvider } from "@/components/ui/toolkit-provider";
import { useNavigationState } from "@/hooks/use-navigation-state";
import { APP_TITLE } from "@/lib/app-config";
import { TAB_ID } from "@/lib/tab-id";

import { i18nCatalog } from "./i18n";

import stylesheet from "./global.css?url";

configureTracking({
  getDefaultProps: (_name, properties) => ({
    ...properties,
    app: "shlawp",
    template: "chat",
  }),
});

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesheet },
];

const THEME_INIT_SCRIPT = getThemeInitScript();
const LOCALE_INIT_SCRIPT = getLocaleInitScript();

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
        />
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
        <script
          data-agent-native-locale-init
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: LOCALE_INIT_SCRIPT }}
        />
        <meta name="theme-color" content="#000000" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="apple-mobile-web-app-title" content={APP_TITLE} />
        <link rel="icon" type="image/svg+xml" href={appPath("/favicon.svg")} />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href={appPath("/favicon-32.png")}
        />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href={appPath("/apple-touch-icon.png")}
        />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

function DbSyncSetup() {
  const qc = useQueryClient();
  useNavigationState();
  useDbSync({
    queryClient: qc,
    ignoreSource: TAB_ID,
  });
  return null;
}

function ThemeToggleItem() {
  const { resolvedTheme, setTheme } = useTheme();
  const t = useT();
  const isDark = resolvedTheme === "dark";
  return (
    <CommandMenu.Item
      onSelect={() => setTheme(isDark ? "light" : "dark")}
      keywords={["theme", "dark", "light", "mode"]}
    >
      {isDark ? <IconSun size={16} /> : <IconMoon size={16} />}
      {t("root.toggleTheme")}
    </CommandMenu.Item>
  );
}

/**
 * The public demo is the chat surface only. Settings, team, database,
 * observability and extensions belong to whoever runs the deployment, and the
 * server refuses them for guests; this keeps a typed URL from landing on a
 * broken page. Dev keeps them reachable for local setup.
 */
const DEMO_ONLY_PREFIXES = [
  "/settings",
  "/agent",
  "/team",
  "/database",
  "/observability",
  "/extensions",
];

function useDemoRouteGuard() {
  const location = useLocation();
  const navigate = useNavigate();
  const blocked =
    !import.meta.env.DEV &&
    DEMO_ONLY_PREFIXES.some(
      (prefix) =>
        location.pathname === prefix ||
        location.pathname.startsWith(`${prefix}/`),
    );

  useEffect(() => {
    if (blocked) navigate("/home", { replace: true });
  }, [blocked, navigate]);

  return blocked;
}

function AppContent() {
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const navigate = useNavigate();
  const t = useT();
  const location = useLocation();
  const isChatThread = location.pathname.startsWith("/chat/");
  const blockedRoute = useDemoRouteGuard();
  useCommandMenuShortcut(useCallback(() => setCmdkOpen(true), []));
  return (
    <>
      <CommandMenu open={cmdkOpen} onOpenChange={setCmdkOpen}>
        <CommandMenu.Group heading={t("root.commandActions")}>
          {isChatThread ? (
            <CommandMenu.Item
              onSelect={() =>
                window.dispatchEvent(new Event("agent-chat:new-chat"))
              }
            >
              {t("chat.newChat")}
            </CommandMenu.Item>
          ) : null}
          {!isChatThread && location.pathname !== "/home" ? (
            <CommandMenu.Item onSelect={() => navigate("/home")}>
              {t("navigation.chat")}
            </CommandMenu.Item>
          ) : null}
          {import.meta.env.DEV ? (
            <CommandMenu.Item
              onSelect={() => navigate("/settings/agent")}
              keywords={[
                "agent",
                "context",
                "files",
                "connections",
                "jobs",
                "access",
              ]}
            >
              <IconHierarchy2 size={16} />
              {t("settings.openAgentSettings")}
            </CommandMenu.Item>
          ) : null}
        </CommandMenu.Group>
        <CommandMenu.Group heading={t("root.commandAppearance")}>
          <ThemeToggleItem />
        </CommandMenu.Group>
      </CommandMenu>
      <AppLayout>{blockedRoute ? null : <Outlet />}</AppLayout>
    </>
  );
}

export default function Root() {
  const [queryClient] = useState(() => createAgentNativeQueryClient());
  const location = useLocation();
  const isMarketingPath = location.pathname === "/";
  return (
    <AppToolkitProvider>
      <AppProviders
        queryClient={queryClient}
        isPublicPath={isMarketingPath}
        i18n={{ catalog: i18nCatalog }}
      >
        {isMarketingPath ? (
          <Outlet />
        ) : (
          <>
            <DbSyncSetup />
            <AppContent />
          </>
        )}
      </AppProviders>
    </AppToolkitProvider>
  );
}

export { ErrorBoundary } from "@agent-native/core/client/ui";
