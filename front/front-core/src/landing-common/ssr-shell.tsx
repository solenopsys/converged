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
  --ssr-pad: 0px;
  --ssr-menu-width: 276px;
  --ssr-rail-width: 380px;
  --ssr-gap: 0px;
  --ssr-rail-space: 0px;
}
#app-shell {
  min-height: 100vh;
}
#ssr-shell {
  display: block;
  min-height: 100vh;
  --ssr-rail-space: 0px;
  padding: var(--ssr-pad);
  padding-left: calc(
    var(--ssr-pad) + var(--ssr-menu-width) + var(--ssr-gap) + var(--ssr-rail-space)
  );
  box-sizing: border-box;
  transition: padding-left 220ms ease;
}
#ssr-shell[data-rail-open="1"] {
  --ssr-rail-space: var(--ssr-rail-width);
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
  border-right: 1px solid rgba(148, 163, 184, 0.24);
  background: transparent;
  padding: 4px 0 0;
  box-sizing: border-box;
}
#ssr-right-rail {
  position: fixed;
  top: var(--ssr-pad);
  left: calc(var(--ssr-pad) + var(--ssr-menu-width) + var(--ssr-gap));
  bottom: var(--ssr-pad);
  width: var(--ssr-rail-width);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-left: 1px solid rgba(148, 163, 184, 0.24);
  border-right: 1px solid rgba(148, 163, 184, 0.24);
  border-top: none;
  border-bottom: none;
  border-radius: 0;
  background: #0b0d13;
  backdrop-filter: none;
  isolation: isolate;
  box-sizing: border-box;
  transform: translateX(0);
  opacity: 1;
  transition: transform 220ms ease, opacity 220ms ease;
  z-index: 5;
}
#ssr-right-rail[data-open="0"] {
  transform: translateX(calc(-1 * var(--ssr-rail-width)));
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}
#ssr-right-rail[data-open="1"] {
  visibility: visible;
}
#ssr-right-rail-chat,
#ssr-right-rail-tab {
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  overflow-y: auto;
  overflow-x: hidden;
}
#ssr-right-rail[data-mode="chat"] #ssr-right-rail-tab {
  display: none;
}
#ssr-right-rail[data-mode="tab"] #ssr-right-rail-chat {
  display: none;
}
#slot-panel-chat,
#slot-panel-tab {
  min-height: 100%;
  min-width: 0;
}
.ssr-right-rail-empty {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px 18px;
}
.ssr-right-rail-empty h3 {
  margin: 0;
  font-size: 30px;
  line-height: 1.08;
}
.ssr-right-rail-empty p {
  margin: 0;
  opacity: 0.72;
}
.ssr-panel-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 24px;
  margin: 0 0 8px;
  padding: 10px 14px 0;
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
  margin: 0 0 8px;
  padding: 0 14px;
  font-size: 14px;
  font-weight: 600;
}
.ssr-panel-link {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  border: none;
  border-radius: 6px;
  padding: 0 12px;
  text-decoration: none;
  color: inherit;
  font-size: 15px;
  font-weight: 500;
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
  padding: 10px 14px 0;
  border-top: 1px solid rgba(148, 163, 184, 0.25);
  font-size: 12px;
  opacity: 0.85;
}
#ssr-main {
  min-width: 0;
  border: none;
  border-radius: 0;
  padding: 0;
  box-sizing: border-box;
  overflow: hidden;
}
#root {
  min-width: 0;
}
@media (max-width: 980px) {
  #ssr-shell {
    padding: 0;
  }
  #ssr-left-panel {
    position: static;
    width: auto;
    margin-bottom: 0;
    max-height: none;
  }
  #ssr-right-rail {
    position: static;
    left: auto;
    top: auto;
    bottom: auto;
    width: auto;
    margin-bottom: 0;
    min-height: 280px;
    transform: none;
  }
  #ssr-right-rail[data-open="0"] {
    display: none;
    opacity: 0;
    visibility: hidden;
  }
  #ssr-right-rail[data-open="1"] {
    display: flex;
    opacity: 1;
    visibility: visible;
  }
}
`;

export function SsrShellLayout({ children }: { children: ReactNode }) {
  return (
    <div id="app-shell" data-island="spa-shell" data-island-load="eager" data-rail-open="0">
      <div id="ssr-shell" data-rail-open="0">
        <aside id="ssr-left-panel" aria-label="Menu">
          <div className="ssr-panel-brand" aria-label="Brand">
            <img className="ssr-panel-brand-logo-light" src="/header-logo-black.svg" alt="Converged AI" />
            <img className="ssr-panel-brand-logo-dark" src="/header-logo-white.svg" alt="Converged AI" />
          </div>
          <h2 className="ssr-panel-title">Menu</h2>
          <div className="ssr-panel-groups" data-ssr-menu-groups />
          <div id="ssr-seconds-counter">uptime 0s</div>
        </aside>
        <aside id="ssr-right-rail" aria-label="Panel" data-open="0" data-mode="chat">
          <section id="ssr-right-rail-chat">
            <div id="slot-panel-chat">
              <div className="ssr-right-rail-empty">
                <h3>Ask us anything</h3>
                <p>Loading AI assistant...</p>
              </div>
            </div>
          </section>
          <section id="ssr-right-rail-tab">
            <div id="slot-panel-tab" />
          </section>
          <div id="ssr-slot-provider-root" />
        </aside>
        <div id="ssr-main">
          <div id="root">{children}</div>
        </div>
      </div>
    </div>
  );
}
