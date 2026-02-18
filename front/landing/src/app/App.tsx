import {
  BrowserRouter,
  Routes,
  Route,
  Outlet,
  useOutlet,
  StaticRouter,
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
    <Route path="/" element={<RootLayout />}>
      <Route index element={<Home />} />
      <Route path="about" element={<About />} />
      <Route path="docs/:slug" element={<DocsPage />} />
    </Route>
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
