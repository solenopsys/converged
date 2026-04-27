import type { ReactNode } from "react";
import { AVAILABLE_LANGS } from "./i18n";

/**
 * Pre-paint script: restores theme from localStorage before first paint.
 */
export const themeBootstrapScript = `
(function(){
  try{
    var AUTH_KEYS=["oauth_provider","oauth_code","oauth_state","auth_token","token","access_token"];
    var href=String(window.location&&window.location.href||"");
    if(href){
      var url=new URL(href);
      var authToken=url.searchParams.get("auth_token")||url.searchParams.get("access_token")||url.searchParams.get("token");
      var hasOauthCallback=Boolean(url.searchParams.get("oauth_provider")&&url.searchParams.get("oauth_code"));
      if(authToken){
        var parts=authToken.split(".");
        var isJwt=parts.length===3&&parts[0].trim()&&parts[1].trim()&&parts[2].trim();
        if(isJwt){
          localStorage.setItem("authToken",authToken);
          sessionStorage.removeItem("tempUserId");
          sessionStorage.removeItem("tempSessionId");
        }
      }
      if(authToken||hasOauthCallback){
        for(var i=0;i<AUTH_KEYS.length;i++){ url.searchParams.delete(AUTH_KEYS[i]); }
        history.replaceState(history.state,"",url.toString());
      }
    }
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
  --ssr-dock-height: 220px;
  --ssr-gap: 0px;
  --ssr-rail-space: 0px;
  --ssr-panel-head-height: 52px;
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
#ssr-shell[data-rail-wide="1"] {
  --ssr-rail-width: 460px;
}
#ssr-left-panel {
  position: fixed;
  top: var(--ssr-pad);
  left: var(--ssr-pad);
  bottom: auto;
  width: var(--ssr-menu-width);
  height: fit-content;
  max-height: calc(100vh - (var(--ssr-pad) * 2) - var(--ssr-dock-height));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: none;
  border-radius: 0;
  border-right: 1px solid color-mix(in oklch, var(--ui-border) 84%, transparent);
  background: transparent;
  color: var(--ui-foreground);
  padding: 0;
  box-sizing: border-box;
  z-index: 6;
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
  border-left: 1px solid color-mix(in oklch, var(--ui-border) 84%, transparent);
  border-right: 1px solid color-mix(in oklch, var(--ui-border) 84%, transparent);
  border-top: none;
  border-bottom: none;
  border-radius: 0;
  background: var(--ui-card);
  color: var(--ui-card-foreground);
  backdrop-filter: none;
  isolation: isolate;
  box-sizing: border-box;
  transform: translateX(0);
  opacity: 1;
  transition: transform 220ms ease, opacity 220ms ease;
  z-index: 5;
}
#ssr-right-rail-head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: var(--ssr-panel-head-height);
  padding: 10px 14px;
  border-bottom: 1px solid color-mix(in oklch, var(--ui-border) 74%, transparent);
  box-sizing: border-box;
}
.ssr-right-rail-tab-btn {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in oklch, var(--ui-border) 74%, transparent);
  border-radius: 8px;
  background: transparent;
  color: color-mix(in oklch, currentColor 82%, transparent);
  cursor: pointer;
}
.ssr-right-rail-tab-btn svg {
  width: 16px;
  height: 16px;
  display: block;
}
.ssr-right-rail-tab-btn[aria-pressed="true"] {
  background: color-mix(in oklch, var(--ui-muted) 84%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--ui-border) 96%, transparent);
}
#ssr-right-rail[data-open="0"] {
  transform: translateX(calc(-1 * (var(--ssr-menu-width) + var(--ssr-rail-width))));
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
  margin: 0;
  padding: 0;
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
.ssr-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: var(--ssr-panel-head-height);
  padding: 10px 14px;
  border-bottom: 1px solid color-mix(in oklch, var(--ui-border) 74%, transparent);
  box-sizing: border-box;
}
.ssr-panel-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ssr-panel-control {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in oklch, var(--ui-border) 74%, transparent);
  border-radius: 8px;
  background: transparent;
  color: color-mix(in oklch, currentColor 82%, transparent);
  cursor: pointer;
}
.ssr-panel-control svg {
  width: 16px;
  height: 16px;
  display: block;
}
.ssr-panel-control:hover {
  background: color-mix(in oklch, var(--ui-muted) 88%, transparent);
}
.ssr-panel-control[aria-pressed="true"] {
  box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--ui-border) 96%, transparent);
}
.ssr-lang-control {
  position: relative;
}
.ssr-lang-trigger {
  width: auto;
  min-width: 30px;
  padding: 0 8px;
  gap: 6px;
}
.ssr-lang-current {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  line-height: 1;
}
.ssr-lang-popover {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 30;
  display: none;
  min-width: 164px;
  padding: 6px;
  border: 1px solid color-mix(in oklch, var(--ui-border) 88%, transparent);
  border-radius: 10px;
  background: color-mix(in oklch, var(--ui-card) 94%, transparent);
  box-shadow: 0 12px 30px rgba(2, 6, 23, 0.35);
  backdrop-filter: blur(10px);
}
.ssr-lang-control[data-open="1"] .ssr-lang-popover {
  display: grid;
  gap: 4px;
}
.ssr-lang-option {
  width: 100%;
  min-height: 30px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: inherit;
  text-align: left;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.2;
  padding: 5px 8px;
  cursor: pointer;
}
.ssr-lang-option:hover {
  background: color-mix(in oklch, var(--ui-muted) 90%, transparent);
}
.ssr-lang-option[aria-pressed="true"] {
  border-color: color-mix(in oklch, var(--ui-border) 96%, transparent);
  background: color-mix(in oklch, var(--ui-muted) 84%, transparent);
}
.ssr-panel-title {
  margin: 8px 0 8px;
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
  flex: 0 0 auto;
  overflow-y: auto;
  overflow-x: hidden;
}
.ssr-panel-group {
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 8px;
  padding: 6px 9px;
  font-size: 13px;
}
#ssr-chat-dock {
  position: fixed;
  left: var(--ssr-pad);
  bottom: var(--ssr-pad);
  width: var(--ssr-menu-width);
  z-index: 8;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 12px 10px;
  border-top: 1px solid color-mix(in oklch, var(--ui-border) 84%, transparent);
  background: color-mix(in oklch, var(--ui-card) 92%, transparent);
  box-sizing: border-box;
  transition: width 220ms ease;
}
#ssr-shell[data-rail-open="1"] #ssr-chat-dock {
  width: var(--ssr-menu-width);
}
#ssr-chat-quick {
  display: flex;
  flex-direction: column-reverse;
  gap: 8px;
  overflow: hidden;
  opacity: 1;
  transform: translateY(0);
  transition: opacity 140ms ease, transform 140ms ease;
}
.ssr-chat-quick-btn {
  border: 1px solid color-mix(in oklch, var(--ui-border) 74%, transparent);
  background: color-mix(in oklch, var(--ui-muted) 72%, transparent);
  color: var(--ui-foreground);
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.25;
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}
.ssr-chat-quick-btn:hover {
  background: color-mix(in oklch, var(--ui-muted) 88%, transparent);
}
.ssr-chat-quick-icon {
  width: 16px;
  height: 16px;
  display: inline-flex;
  flex: 0 0 16px;
  color: color-mix(in oklch, var(--ui-foreground) 72%, transparent);
}
.ssr-chat-quick-icon svg {
  width: 16px;
  height: 16px;
}
#ssr-chat-form {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  border: 1px solid color-mix(in oklch, var(--ui-border) 84%, transparent);
  border-radius: 10px;
  padding: 6px 8px 6px 10px;
  background: color-mix(in oklch, var(--ui-card) 92%, transparent);
}
#ssr-chat-input {
  flex: 1 1 auto;
  min-width: 0;
  border: none;
  background: transparent;
  color: var(--ui-foreground);
  font-size: 14px;
  line-height: 1.35;
  outline: none;
}
#ssr-chat-input::placeholder {
  color: color-mix(in oklch, var(--ui-foreground) 58%, transparent);
}
#ssr-chat-send {
  width: 30px;
  height: 30px;
  border: 1px solid color-mix(in oklch, var(--ui-border) 74%, transparent);
  border-radius: 8px;
  background: transparent;
  color: color-mix(in oklch, currentColor 82%, transparent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
#ssr-chat-send svg {
  width: 15px;
  height: 15px;
  display: block;
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
    height: auto;
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
  #ssr-chat-dock {
    position: fixed;
    left: var(--ssr-pad);
    bottom: var(--ssr-pad);
    width: var(--ssr-menu-width);
  }
  #ssr-shell[data-rail-open="1"] #ssr-chat-dock {
    width: calc(var(--ssr-menu-width) + var(--ssr-rail-width));
  }
}
`;

export function SsrShellLayout({
  children,
  loginEnabled = true,
}: {
  children: ReactNode;
  loginEnabled?: boolean;
}) {
  return (
    <div id="app-shell" data-island="spa-shell" data-island-load="eager" data-rail-open="0">
      <div id="ssr-shell" data-rail-open="0">
        <aside id="ssr-left-panel" aria-label="Menu">
          <div className="ssr-panel-head">
            <div className="ssr-panel-brand" aria-label="Brand">
              <img className="ssr-panel-brand-logo-light" src="/header-logo-black.svg" alt="Converged AI" />
              <img className="ssr-panel-brand-logo-dark" src="/header-logo-white.svg" alt="Converged AI" />
            </div>
            <div className="ssr-panel-controls" aria-label="Menu controls">
              {loginEnabled ? (
                <button type="button" className="ssr-panel-control" data-ssr-control="auth" aria-label="Open login">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                    <path d="M10 17l5-5-5-5" />
                    <path d="M15 12H3" />
                  </svg>
                </button>
              ) : null}
              <button type="button" className="ssr-panel-control" data-ssr-control="theme" aria-label="Toggle theme">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2" />
                  <path d="M12 20v2" />
                  <path d="m4.93 4.93 1.41 1.41" />
                  <path d="m17.66 17.66 1.41 1.41" />
                  <path d="M2 12h2" />
                  <path d="M20 12h2" />
                  <path d="m6.34 17.66-1.41 1.41" />
                  <path d="m19.07 4.93-1.41 1.41" />
                </svg>
              </button>
              <div className="ssr-lang-control" data-ssr-lang-root data-open="0">
                <button
                  type="button"
                  className="ssr-panel-control ssr-lang-trigger"
                  data-ssr-control="lang"
                  aria-label="Language"
                  aria-haspopup="menu"
                  aria-expanded="false"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M3 12h18" />
                    <path d="M12 3a13 13 0 0 1 0 18" />
                    <path d="M12 3a13 13 0 0 0 0 18" />
                  </svg>
                  <span className="ssr-lang-current" data-ssr-lang-current>EN</span>
                </button>
                <div className="ssr-lang-popover" data-ssr-lang-menu role="menu" aria-label="Language options">
                  {AVAILABLE_LANGS.map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      role="menuitemradio"
                      className="ssr-lang-option"
                      data-ssr-lang-option={lang.code}
                      aria-pressed="false"
                    >
                      {lang.name}
                    </button>
                  ))}
                </div>
              </div>
              <button type="button" className="ssr-panel-control" data-ssr-control="rail" aria-label="Show panel" aria-pressed="false">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <path d="M8 4v16" />
                  <path d="m14 9 3 3-3 3" />
                </svg>
              </button>
            </div>
          </div>
          <div className="ssr-panel-groups" data-ssr-menu-groups />
          <div id="ssr-chat-dock" data-overlap="0">
            <div id="ssr-chat-quick" />
            <form id="ssr-chat-form">
              <input id="ssr-chat-input" type="text" placeholder="Напишите сообщение..." autoComplete="off" />
              <button id="ssr-chat-send" type="submit" aria-label="Send message">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2L11 13" />
                  <path d="M22 2 15 22 11 13 2 9 22 2z" />
                </svg>
              </button>
            </form>
          </div>
        </aside>
        <aside id="ssr-right-rail" aria-label="Panel" data-open="0" data-mode="chat">
          <div id="ssr-right-rail-head">
            <button type="button" className="ssr-right-rail-tab-btn" data-ssr-rail-tab="chat" aria-label="AI panel" aria-pressed="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </button>
            <button type="button" className="ssr-right-rail-tab-btn" data-ssr-rail-tab="tab" aria-label="Form panel" aria-pressed="false">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path d="M12 4v16" />
              </svg>
            </button>
          </div>
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
