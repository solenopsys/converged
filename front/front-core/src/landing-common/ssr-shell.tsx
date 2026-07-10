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
          // Mark this load as a fresh sign-in so the client routes the user into
          // /console once (consumed on read). A plain reload of a public page
          // carries no token in the URL and so never sets this flag.
          sessionStorage.setItem("freshLogin","1");
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

// ── Static SSR menu (no hydration) ────────────────────────────────────────────
// A <details>/<summary> tree rendered server-side. Expand/collapse is native
// browser behavior, links are plain anchors; the SPA only adopts the DOM node
// into the panel's menu tab and controls its visibility.

export type SsrStaticMenuItem = {
	title?: string;
	href?: string;
	items?: SsrStaticMenuItem[];
};

function menuPath(href: string | undefined): string {
	if (!href) return "";
	const clean = href.split("#")[0]?.split("?")[0] ?? "";
	return clean !== "/" && clean.endsWith("/") ? clean.slice(0, -1) : clean;
}

function subtreeContainsPath(
	item: SsrStaticMenuItem,
	currentPath: string,
): boolean {
	if (!currentPath) return false;
	if (menuPath(item.href) === currentPath) return true;
	return (item.items ?? []).some((child) =>
		subtreeContainsPath(child, currentPath),
	);
}

function SsrStaticMenuNode({
	item,
	currentPath,
}: {
	item: SsrStaticMenuItem;
	currentPath: string;
}) {
	const title = typeof item.title === "string" ? item.title.trim() : "";
	if (!title) return null;
	const children = (item.items ?? []).filter(
		(child) => typeof child.title === "string" && child.title.trim(),
	);
	const isActive = Boolean(item.href) && menuPath(item.href) === currentPath;

	if (children.length === 0) {
		if (!item.href) return null;
		return (
			<a
				className="ssr-menu-link"
				href={item.href}
				aria-current={isActive ? "page" : undefined}
			>
				{title}
			</a>
		);
	}

	return (
		<details
			className="ssr-menu-group"
			open={subtreeContainsPath(item, currentPath) || undefined}
		>
			<summary className="ssr-menu-summary">{title}</summary>
			<div className="ssr-menu-children">
				{children.map((child, i) => (
					<SsrStaticMenuNode
						key={`${child.title ?? i}:${child.href ?? i}`}
						item={child}
						currentPath={currentPath}
					/>
				))}
			</div>
		</details>
	);
}

export function SsrStaticMenu({
	items,
	currentPath = "",
	label = "Site menu",
}: {
	items: SsrStaticMenuItem[];
	/** Current URL pathname (locale-prefixed, no hash/query) to mark active links and pre-open groups. */
	currentPath?: string;
	label?: string;
}) {
	const path = menuPath(currentPath);
	return (
		<nav className="ssr-menu" aria-label={label}>
			{items.map((item, i) => (
				<SsrStaticMenuNode
					key={`${item.title ?? i}:${item.href ?? i}`}
					item={item}
					currentPath={path}
				/>
			))}
		</nav>
	);
}

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
	staticMenu,
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
	/**
	 * Server-rendered static menu (see SsrStaticMenu). Ships hidden in the SSR
	 * HTML; the SPA adopts the node into the panel's menu tab and toggles it.
	 */
	staticMenu?: ReactNode;
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
				{staticMenu ? (
					<div id="ssr-static-menu" hidden>
						{staticMenu}
					</div>
				) : null}
				<div id="ssr-main">
					<div id="root">{children}</div>
				</div>
			</div>
		</div>
	);
}
