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
import { Home } from "./pages/Home";
import { About } from "./pages/About";
import { DocsPage } from "./pages/DocsPage";
import { DEFAULT_LOCALE, buildLocalePath, isSupportedLocale } from "./i18n";

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
    return () => {
      active = false;
    };
  }, []);

  if (!ClientLayout) {
    // SSR - простая обёртка без компонентов, завязанных на client-only контекст
    return (
      <div className="min-h-screen">
        {stableOutletNode}
      </div>
    );
  }

  // Client - полный layout с панелями
  return <ClientLayout centerFallback={stableOutletNode} />;
}

function renderAppRoutes() {
  return (
    <>
      <Route path="/" element={<Navigate to={`/${DEFAULT_LOCALE}/`} replace />} />
      <Route path="/console" element={null} />
      <Route path="/console/*" element={null} />
      <Route path="/about" element={<LegacyPathRedirect />} />
      <Route path="/docs/:slug" element={<LegacyPathRedirect />} />

      <Route path="/:locale" element={<LocaleLayout />}>
        <Route index element={<Home />} />
        <Route path="about" element={<About />} />
        <Route path="docs/:slug" element={<DocsPage />} />
        <Route path="console" element={null} />
        <Route path="console/*" element={null} />
      </Route>

      <Route path="*" element={<Navigate to={`/${DEFAULT_LOCALE}/`} replace />} />
    </>
  );
}

function LocaleLayout() {
  const { locale } = useParams<{ locale: string }>();
  const location = useLocation();

  if (!isSupportedLocale(locale)) {
    const restPath = location.pathname.replace(/^\/[^/]+/, "") || "/";
    return (
      <Navigate
        to={{
          pathname: buildLocalePath(DEFAULT_LOCALE, restPath),
          search: location.search,
          hash: location.hash,
        }}
        replace
      />
    );
  }

  return <RootLayout />;
}

function LegacyPathRedirect() {
  const location = useLocation();
  return (
    <Navigate
      to={{
        pathname: buildLocalePath(DEFAULT_LOCALE, location.pathname),
        search: location.search,
        hash: location.hash,
      }}
      replace
    />
  );
}

// SSR App component - simple StaticRouter without loaders
export function AppSSR({ url }: { url: string }) {
  return (
    <StaticRouter location={url}>
      <Routes>
        {renderAppRoutes()}
      </Routes>
    </StaticRouter>
  );
}

// Client App component
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {renderAppRoutes()}
      </Routes>
    </BrowserRouter>
  );
}
