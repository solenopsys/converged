import type { ReactNode } from "react";

export interface SeoMeta {
  title?: string;
  description?: string;
  keywords?: string[];
  canonical?: string;
  ogImage?: string;
}

interface DocumentProps {
  children: ReactNode;
  seo?: SeoMeta;
  lang?: string;
  importMap?: Record<string, string>;
  initialData?: Record<string, unknown>;
}

/**
 * Pre-paint script: restores theme from localStorage before first paint.
 */
const themeBootstrapScript = `
(function(){
  try{
    var stored=localStorage.getItem("theme");
    var prefersDark=window.matchMedia&&window.matchMedia("(prefers-color-scheme:dark)").matches;
    var theme=stored==="light"||stored==="dark"?stored:(prefersDark?"dark":"light");
    var root=document.documentElement;
    root.classList.toggle("dark",theme==="dark");
    root.style.colorScheme=theme;
  }catch(_){}
})();
`;

/**
 * Minimal pre-JS styles — show SSR content readably before spa-shell mounts.
 * Once BaseLayout mounts (eager island), it takes over the layout entirely.
 */
const preSsrCss = `
body { margin: 0; }
#app-shell {
  min-height: 100vh;
}
#ssr-shell {
  display: block;
  min-height: 100vh;
  padding: 14px;
  box-sizing: border-box;
}
#ssr-left-panel {
  position: fixed;
  top: 14px;
  left: 14px;
  bottom: 14px;
  width: 276px;
  display: flex;
  flex-direction: column;
  overflow: auto;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.35);
  padding: 12px;
  box-sizing: border-box;
}
.ssr-panel-title {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 600;
}
.ssr-panel-nav {
  display: grid;
  gap: 8px;
  margin-bottom: 12px;
}
.ssr-panel-link {
  display: block;
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 9px;
  padding: 8px 10px;
  text-decoration: none;
  color: inherit;
  font-size: 14px;
}
.ssr-panel-groups {
  display: grid;
  gap: 6px;
}
.ssr-panel-group {
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 8px;
  padding: 6px 9px;
  font-size: 13px;
}
#ssr-seconds-counter {
  margin-top: auto;
  padding-top: 10px;
  border-top: 1px solid rgba(148, 163, 184, 0.25);
  font-size: 12px;
  opacity: 0.85;
}
#ssr-main {
  min-width: 0;
  margin-left: calc(276px + 14px + 14px);
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 12px;
  padding: 14px;
  box-sizing: border-box;
}
#root {
  min-width: 0;
}
@media (max-width: 980px) {
  #ssr-left-panel {
    position: static;
    width: auto;
    margin-bottom: 12px;
    max-height: none;
  }
  #ssr-main {
    margin-left: 0;
  }
}
`;

export function Document({ children, seo, lang = "en", importMap, initialData }: DocumentProps) {
  const title = seo?.title ?? "Landing";
  const description = seo?.description ?? "";
  const keywords = seo?.keywords?.filter(Boolean).join(", ") ?? "";
  const canonical = seo?.canonical;
  const ogImage = seo?.ogImage;

  const importMapJson = importMap ? JSON.stringify({ imports: importMap }) : null;
  const initialDataJson = initialData ? JSON.stringify(initialData) : null;

  return (
    <html lang={lang}>
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="color-scheme" content="dark light" />
        <title>{title}</title>
        {description ? <meta name="description" content={description} /> : null}
        {keywords ? <meta name="keywords" content={keywords} /> : null}
        <meta name="robots" content="index,follow" />
        {canonical ? <link rel="canonical" href={canonical} /> : null}
        <meta property="og:type" content="website" />
        <meta property="og:title" content={title} />
        {description ? <meta property="og:description" content={description} /> : null}
        {canonical ? <meta property="og:url" content={canonical} /> : null}
        {ogImage ? <meta property="og:image" content={ogImage} /> : null}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        {description ? <meta name="twitter:description" content={description} /> : null}
        {ogImage ? <meta name="twitter:image" content={ogImage} /> : null}
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
        <style dangerouslySetInnerHTML={{ __html: preSsrCss }} />
        {importMapJson ? (
          <script type="importmap" dangerouslySetInnerHTML={{ __html: importMapJson }} />
        ) : null}
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body>
        {initialDataJson ? (
          <script
            id="__INITIAL_DATA__"
            type="application/json"
            dangerouslySetInnerHTML={{ __html: initialDataJson }}
          />
        ) : null}

        {/*
          #app-shell is the island container.
          spa-shell island mounts BaseLayout (from front-core) here eagerly.
          Before JS loads, #root shows SSR content directly.
        */}
        <div id="app-shell" data-island="spa-shell" data-island-load="eager">
          <div id="ssr-shell">
            <aside id="ssr-left-panel" aria-label="Menu">
              <h2 className="ssr-panel-title">Menu</h2>
              <nav className="ssr-panel-nav" data-ssr-menu-links>
                <a className="ssr-panel-link" href="/">Home</a>
                <a className="ssr-panel-link" href="/about">About</a>
                <a className="ssr-panel-link" href="/docs/page1">Docs</a>
              </nav>
              <div className="ssr-panel-groups" data-ssr-menu-groups />
              <div id="ssr-seconds-counter">uptime 0s</div>
            </aside>
            <div id="ssr-main">
              <div id="root">{children}</div>
            </div>
          </div>
        </div>

        {/* Warmup: preloads SPA modules in background */}
        <div data-island="warmup" data-island-load="eager" style={{ display: "none" }} />

        <script type="module" src="/island-client.js" />
      </body>
    </html>
  );
}
