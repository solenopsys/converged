import {
  BrowserRouter,
  Routes,
  Route,
  Outlet,
  useOutlet,
  StaticRouter,
  Navigate,
  useLocation,
  useParams,
} from "react-router-dom";
import {
  useState,
  useEffect,
  useRef,
  type ComponentType,
  type ReactNode,
} from "react";
import { LandingPage } from "./pages/LandingPage";
import { DocsPage } from "./pages/DocsPage";
import { RequestPage } from "./pages/RequestPage";
import { DEFAULT_LOCALE, buildLocalePath, isSupportedLocale } from "./i18n";
import {
  readLocaleRouting,
  type LocaleRoutingConfig,
} from "./locale-routing";

// SSR: simple wrapper, Client: full BaseLayout
function RootLayout() {
  const outletNode = useOutlet();
  const lastOutletRef = useRef<ReactNode>(outletNode);
  if (outletNode) {
    lastOutletRef.current = outletNode;
  }
  const stableOutletNode = outletNode ?? lastOutletRef.current ?? <Outlet />;
  const [ClientLayout, setClientLayout] = useState<ComponentType<{ centerFallback?: ReactNode }> | null>(null);

  useEffect(() => {
    let active = true;
    import("front-core")
      .then((mod) => {
        if (!active) return;
        setClientLayout(() => mod.BaseLayout);
      })
      .catch((error) => {
        console.error("[landing] Failed to load front-core BaseLayout", error);
      });
    return () => { active = false; };
  }, []);

  if (!ClientLayout) {
    return <div className="min-h-screen">{stableOutletNode}</div>;
  }

  return <ClientLayout centerFallback={stableOutletNode} />;
}

function stripLeadingLocale(pathname: string): string {
  const segments = pathname.split("/");
  const locale = segments[1];
  if (!isSupportedLocale(locale)) return pathname || "/";
  const rest = `/${segments.slice(2).join("/")}`;
  return rest === "/" ? "/" : rest.replace(/\/+$/, "") || "/";
}

function renderAppRoutes(localeRouting: LocaleRoutingConfig = readLocaleRouting()) {
  if (localeRouting.mode === "single") {
    return (
      <Route path="/" element={<RootLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="request/:requestId" element={<RequestPage />} />
        <Route path="docs/:slug" element={<DocsPage />} />
        <Route path="console" element={null} />
        <Route path="console/*" element={null} />
        <Route path=":locale/*" element={<SingleLocaleRedirect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    );
  }

  return (
    <Route path="/" element={<RootLayout />}>
      <Route path="/" element={<Navigate to={buildLocalePath(DEFAULT_LOCALE, "/")} replace />} />
      <Route path="/request/:requestId" element={<RequestPage />} />
      <Route path="/console" element={null} />
      <Route path="/console/*" element={null} />
      <Route path="/:locale" element={<LocaleWrapper />}>
        <Route index element={<LandingPage />} />
        <Route path="request/:requestId" element={<RequestPage />} />
        <Route path="docs/:slug" element={<DocsPage />} />
        <Route path="console" element={null} />
        <Route path="console/*" element={null} />
      </Route>
      <Route path="*" element={<Navigate to={buildLocalePath(DEFAULT_LOCALE, "/")} replace />} />
    </Route>
  );
}

function SingleLocaleRedirect() {
  const { locale } = useParams<{ locale?: string }>();
  const location = useLocation();
  if (!isSupportedLocale(locale)) {
    return <Navigate to="/" replace />;
  }
  const strippedPath = stripLeadingLocale(location.pathname);
  return (
    <Navigate
      to={{ pathname: strippedPath, search: location.search, hash: location.hash }}
      replace
    />
  );
}

function LocaleWrapper() {
  const { locale } = useParams<{ locale: string }>();
  const location = useLocation();

  if (!isSupportedLocale(locale)) {
    const restPath = location.pathname.replace(/^\/[^/]+/, "") || "/";
    return (
      <Navigate
        to={{ pathname: buildLocalePath(DEFAULT_LOCALE, restPath), search: location.search, hash: location.hash }}
        replace
      />
    );
  }

  return <Outlet />;
}

// SSR App component
export function AppSSR({
  url,
  localeRouting = readLocaleRouting(),
}: {
  url: string;
  localeRouting?: LocaleRoutingConfig;
}) {
  return (
    <StaticRouter location={url}>
      <Routes>
        {renderAppRoutes(localeRouting)}
      </Routes>
    </StaticRouter>
  );
}

// Client App component — mounted via createRoot in spa-shell island
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {renderAppRoutes(readLocaleRouting())}
      </Routes>
    </BrowserRouter>
  );
}
