import type { ReactNode } from "react";

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
  --ssr-topbar-height: 52px;
  --ssr-rail-width: 380px;
  --ssr-control-panel-width: 380px;
  --ssr-dock-height: 72px;
  --ssr-gap: 0px;
  --ssr-panel-head-height: 52px;
}
#app-shell {
  min-height: 100vh;
}
#ssr-shell {
  display: block;
  min-height: 100vh;
  padding-top: var(--ssr-topbar-height);
  padding-left: 0;
  box-sizing: border-box;
  transition: padding-top 220ms ease, padding-left 220ms ease;
}
#ssr-shell[data-control-panel-mode="app"] {
  padding-top: 0;
  padding-left: var(--ssr-control-panel-width);
}
#ssr-shell[data-rail-wide="1"] {
  --ssr-rail-width: 460px;
}
#ssr-shell[data-rail-resizing="1"],
#app-shell[data-rail-resizing="1"] {
  cursor: col-resize;
}
#ssr-shell[data-rail-resizing="1"] #ssr-topbar,
#ssr-shell[data-rail-resizing="1"] #ssr-right-rail {
  transition: none;
}
#ssr-shell[data-rail-resizing="1"] #ssr-main {
  pointer-events: none;
}

#ssr-control-panel-root {
  position: fixed;
  z-index: 1000;
  box-sizing: border-box;
}
#ssr-shell[data-control-panel-mode="public"] #ssr-control-panel-root {
  top: 0;
  left: 0;
  right: 0;
}
#ssr-shell[data-control-panel-mode="app"] #ssr-control-panel-root {
  top: 0;
  left: 0;
  bottom: 0;
  width: var(--ssr-control-panel-width);
  height: 100vh;
  border-right: 1px solid color-mix(in oklch, var(--ui-border) 84%, transparent);
  background: var(--ui-card);
  overflow: hidden;
}

#ssr-shell[data-control-panel-mode="app"] #ssr-control-panel-root > * {
  height: 100%;
}
#ssr-topbar-row1 {
  display: grid;
  grid-template-columns: auto minmax(300px, 1fr) auto;
  align-items: center;
  gap: 16px;
  padding: 12px 20px;
  min-height: 64px;
  box-sizing: border-box;
}
#ssr-topbar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.ssr-panel-brand-logo-light,
.ssr-panel-brand-logo-dark {
  height: 22px;
  width: auto;
}
.ssr-panel-brand-logo-dark { display: none; }
.dark .ssr-panel-brand-logo-light { display: none; }
.dark .ssr-panel-brand-logo-dark { display: block; }

/* ── Chat form in topbar ── */
#ssr-chat-dock {
  min-width: 0;
}
#ssr-chat-form {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  border: 1px solid color-mix(in oklch, var(--ui-border) 84%, transparent);
  border-radius: 10px;
  padding: 4px 4px 4px 14px;
  background: var(--ui-muted);
  box-sizing: border-box;
}
#ssr-chat-input {
  order: 2;
  flex: 1 1 auto;
  width: auto;
  min-width: 0;
  min-height: 1.35em;
  max-height: calc(1.35em * 3);
  border: none;
  background: transparent;
  color: var(--ui-foreground);
  font-size: 14px;
  line-height: 1.35;
  outline: none;
  resize: none;
  overflow-y: auto;
  padding: 0;
  font-family: inherit;
}
#ssr-chat-input::placeholder {
  color: color-mix(in oklch, var(--ui-foreground) 50%, transparent);
}
#ssr-chat-actions { display: contents; }
#ssr-chat-attach {
  order: 1;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--ui-muted-foreground);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
#ssr-chat-attach svg { width: 15px; height: 15px; display: block; }
#ssr-chat-send {
  order: 3;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border: 0;
  border-radius: 8px;
  background: var(--ui-foreground);
  color: var(--ui-background);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
#ssr-chat-send svg { width: 15px; height: 15px; display: block; }
#ssr-chat-attach:hover {
  background: color-mix(in oklch, var(--ui-muted) 80%, transparent);
  color: var(--ui-foreground);
}

/* ── Topbar controls ── */
#ssr-topbar-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* ── Quick actions row ── */
#ssr-topbar-row2 {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 20px 10px;
  overflow-x: auto;
  scrollbar-width: none;
}
#ssr-topbar-row2::-webkit-scrollbar { display: none; }
#ssr-chat-quick {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
}

/* ── Right rail (AI panel) - fixed on right ── */
#ssr-right-rail {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: var(--ssr-rail-width);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-left: 1px solid color-mix(in oklch, var(--ui-border) 84%, transparent);
  background: var(--ui-card);
  color: var(--ui-card-foreground);
  isolation: isolate;
  box-sizing: border-box;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 180ms ease, visibility 180ms ease;
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
#ssr-right-rail[data-open="1"] {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
}
#ssr-rail-resizer {
  position: absolute;
  top: 0;
  right: -8px;
  bottom: 0;
  width: 16px;
  display: none;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: col-resize;
  z-index: 40;
  touch-action: none;
}
#ssr-rail-resizer::after {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: 7px;
  width: 1px;
  background: color-mix(in oklch, var(--ui-border) 72%, transparent);
  opacity: 0;
  transition: opacity 120ms ease;
}
#ssr-rail-resizer:hover::after,
#ssr-rail-resizer:focus-visible::after,
#ssr-shell[data-rail-resizing="1"] #ssr-rail-resizer::after {
  opacity: 1;
}
#ssr-shell[data-rail-open="1"] #ssr-rail-resizer,
#ssr-shell[data-chat-focus="1"] #ssr-rail-resizer {
  display: block;
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
  min-width: 0;
  width: 100%;
}
#ssr-chat-quick {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
}
#ssr-chat-quick::-webkit-scrollbar { display: none; }
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
  #ssr-shell[data-rail-open="1"],
  #ssr-shell[data-chat-focus="1"] {
    padding-right: 0;
  }
  #ssr-topbar {
    right: 0 !important;
  }
  #ssr-topbar-row1 {
    grid-template-columns: auto 1fr auto;
    gap: 10px;
    padding: 10px 14px;
  }
  #ssr-right-rail {
    top: 0;
    right: 0;
    left: 0;
    bottom: 0;
    width: 100%;
    z-index: 10;
  }
  #ssr-right-rail[data-open="0"] {
    display: none;
  }
  #ssr-rail-resizer {
    display: none !important;
  }
}
`;

export function SsrShellLayout({
	children,
	loginEnabled = true,
	logoLight = "/header-logo-black.svg",
	logoDark = "/header-logo-white.svg",
	chatPlaceholder = "Ask AI anything...",
	brandName = "",
	phone,
	statusText,
}: {
	children: ReactNode;
	loginEnabled?: boolean;
	logoLight?: string;
	logoDark?: string;
	chatPlaceholder?: string;
	brandName?: string;
	phone?: string;
	statusText?: string;
}) {
	return (
		<div id="app-shell" data-rail-open="0">
			<div
				id="ssr-shell"
				data-control-panel-mode="public"
				data-rail-open="0"
				data-chat-focus="0"
			>
				<div
					id="ssr-control-panel-root"
					data-logo-light={logoLight}
					data-logo-dark={logoDark}
					data-brand-name={brandName}
					data-chat-placeholder={chatPlaceholder}
					data-phone={phone ?? ""}
					data-status-text={statusText ?? ""}
					data-login-enabled={loginEnabled ? "1" : "0"}
				/>
				<div id="ssr-main">
					<div id="root">{children}</div>
				</div>
			</div>
		</div>
	);
}
