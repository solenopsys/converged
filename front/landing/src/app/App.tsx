import {
  BrowserRouter,
  Routes,
  Route,
  StaticRouter,
} from "react-router-dom";
import {
  useState,
  useEffect,
  type ComponentType,
  type ReactNode,
} from "react";
import { Home } from "./pages/Home";
import { About } from "./pages/About";
import { DocsPage } from "./pages/DocsPage";

function ConsoleSsrShell() {
  return (
    <div
      className="min-h-screen w-full bg-background text-foreground"
      style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 390px" }}
      data-console-shell="ssr"
    >
      <main
        id="slot-center"
        data-sidebar-slot="sidebar:center"
        style={{ minWidth: 0, minHeight: "100vh", overflow: "auto" }}
      >
        <div style={{ padding: 24, opacity: 0.65, fontSize: 14 }}>Loading console...</div>
      </main>

      <aside
        data-sidebar="right"
        style={{
          minHeight: "100vh",
          borderLeft: "1px solid oklch(var(--border))",
          display: "grid",
          gridTemplateColumns: "1fr 48px",
          background: "oklch(var(--sidebar))",
        }}
      >
        <section
          data-sidebar-content="right"
          style={{ minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}
        >
          <header style={{ height: 52, borderBottom: "1px solid oklch(var(--border))" }} />
          <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
            <div id="slot-panel-menu" data-sidebar-slot="sidebar:left" style={{ position: "absolute", inset: 0, overflow: "auto" }} />
            <div id="slot-panel-tab" data-sidebar-slot="sidebar:tab" style={{ position: "absolute", inset: 0, overflow: "auto" }} />
            <div id="slot-panel-chat" data-sidebar-slot="sidebar:right" style={{ position: "absolute", inset: 0, overflow: "auto" }} />
          </div>
          <footer id="slot-input" data-sidebar-slot="sidebar:input" style={{ height: 96, borderTop: "1px solid oklch(var(--border))" }} />
        </section>
        <nav
          id="slot-tabs"
          data-sidebar-tabs="left"
          data-sidebar-slot="sidebar:tabs"
          style={{ borderLeft: "1px solid oklch(var(--border))" }}
        />
      </aside>
    </div>
  );
}

// /console: client-only shell with front-core BaseLayout
function ConsoleLayout() {
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
    // SSR + first client paint: stable mount points for slot-based console rendering.
    return <ConsoleSsrShell />;
  }

  return <ClientLayout centerFallback={null} />;
}

function renderAppRoutes() {
  return (
    <>
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
      <Route path="/docs/:slug" element={<DocsPage />} />
      <Route path="/console/*" element={<ConsoleLayout />} />
    </>
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
