import type { ReactNode } from "react";

/**
 * Pre-paint script: restores theme from localStorage before first paint.
 */
export const themeBootstrapScript = `
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
 * SSR shell styles used before spa-shell mounts.
 */
export const preSsrShellCss = `
body { margin: 0; }
:root {
  --ssr-pad: 14px;
  --ssr-menu-width: 276px;
  --ssr-gap: 14px;
}
#app-shell {
  min-height: 100vh;
}
#ssr-shell {
  display: block;
  min-height: 100vh;
  padding: var(--ssr-pad);
  padding-left: calc(var(--ssr-pad) + var(--ssr-menu-width) + var(--ssr-gap));
  box-sizing: border-box;
}
#ssr-left-panel {
  position: fixed;
  top: var(--ssr-pad);
  left: var(--ssr-pad);
  bottom: var(--ssr-pad);
  width: var(--ssr-menu-width);
  display: flex;
  flex-direction: column;
  overflow: auto;
  border: none;
  border-radius: 0;
  background: transparent;
  padding: 4px 0 0;
  box-sizing: border-box;
}
.ssr-panel-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 24px;
  margin: 0 0 12px;
}
.ssr-panel-brand-logo-light,
.ssr-panel-brand-logo-dark {
  height: 20px;
  width: auto;
}
.ssr-panel-brand-logo-dark {
  display: none;
}
.dark .ssr-panel-brand-logo-light {
  display: none;
}
.dark .ssr-panel-brand-logo-dark {
  display: block;
}
.ssr-panel-title {
  margin: 0 0 10px 2px;
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
  border: none;
  border-radius: 0;
  padding: 14px 0 0;
  box-sizing: border-box;
  overflow: hidden;
}
#root {
  min-width: 0;
}
@media (max-width: 980px) {
  #ssr-shell {
    padding: var(--ssr-pad);
  }
  #ssr-left-panel {
    position: static;
    width: auto;
    margin-bottom: 12px;
    max-height: none;
  }
}
`;

export function SsrShellLayout({ children }: { children: ReactNode }) {
  return (
    <div id="app-shell" data-island="spa-shell" data-island-load="eager">
      <div id="ssr-shell">
        <aside id="ssr-left-panel" aria-label="Menu">
          <div className="ssr-panel-brand" aria-label="Brand">
            <img className="ssr-panel-brand-logo-light" src="/header-logo-black.svg" alt="Converged AI" />
            <img className="ssr-panel-brand-logo-dark" src="/header-logo-white.svg" alt="Converged AI" />
          </div>
          <h2 className="ssr-panel-title">Menu</h2>
          <nav className="ssr-panel-nav" data-ssr-menu-links>
            <a className="ssr-panel-link" href="/">
              Home
            </a>
            <a className="ssr-panel-link" href="/about">
              About
            </a>
            <a className="ssr-panel-link" href="/docs/page1">
              Docs
            </a>
          </nav>
          <div className="ssr-panel-groups" data-ssr-menu-groups />
          <div id="ssr-seconds-counter">uptime 0s</div>
        </aside>
        <div id="ssr-main">
          <div id="root">{children}</div>
        </div>
      </div>
    </div>
  );
}
