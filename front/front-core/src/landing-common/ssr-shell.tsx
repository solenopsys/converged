import type { ReactNode } from "react";
import "./ssr-shell.css";

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

type SsrShellMenuLink = {
	label: string;
	href: string;
};

export function SsrShellLayout({
	children,
	loginEnabled = true,
	logoLight = "/header-logo-black.svg",
	logoDark = "/header-logo-white.svg",
	chatPlaceholder = "Ask AI anything...",
	brandName = "",
	phone,
	statusText,
	menuLinks = [],
}: {
	children: ReactNode;
	loginEnabled?: boolean;
	logoLight?: string;
	logoDark?: string;
	chatPlaceholder?: string;
	brandName?: string;
	phone?: string;
	statusText?: string;
	menuLinks?: SsrShellMenuLink[];
}) {
	const menuLinksJson = menuLinks.length > 0 ? JSON.stringify(menuLinks) : "";

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
					data-menu-links={menuLinksJson}
					data-login-enabled={loginEnabled ? "1" : "0"}
				/>
				<div id="ssr-main">
					<div id="root">{children}</div>
				</div>
			</div>
		</div>
	);
}
