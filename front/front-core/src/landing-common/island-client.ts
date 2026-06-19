import { structClient } from "g-struct";
import { KeyRound } from "lucide-react";
import { createElement, type ReactNode } from "react";
import { createBridgeController } from "../bridge";
import {
	chatAttachRequested,
	chatInitRequested,
	chatSendRequested,
} from "../chat/events";
import { rightRailActionSelected } from "../components/right-rail/uri-sync";
import { CHAT_CONTEXT, VOICE_CONTEXT } from "./context-names";
import { ConsoleAuthSplash } from "../components/state-stream/ConsoleAuthSplash";
import { StateStreamView } from "../components/state-stream/StateStreamView";
import {
	$allMenuItems,
	addMenuRequested,
	authToken,
	bus,
	clearAllMenus,
	registry,
	runActionEvent,
} from "../controllers";
import { LocaleController } from "../controllers/locale-controller";
import { getI18nInstance } from "../i18n";
import { $centerView, setCenterView } from "../slots/present";
import { SlotInline } from "../slots/SlotInline";
import {
	$controlPanelMode,
	type ControlPanelMode,
	controlPanelClosed,
	controlPanelModeChanged,
	controlPanelOpened,
	MENU_TAB_ID,
	readControlPanelMode,
	tabActivated,
	tabContentRegistered,
} from "./control-panel-model";
import { GROUPS } from "./groups";
import {
	AVAILABLE_LANGS,
	buildLocalePath,
	extractLocaleFromPath,
	isSupportedLocale,
	type SupportedLocale,
} from "./i18n";
import {
	readInitialLocaleRouting,
	resolveRuntimeLocale,
	stripRuntimeLocalePrefix,
} from "./locale-routing";

const SSR_MENU_STYLE_ID = "ssr-menu-shell-style";
const FRONT_CORE_STYLE_ID = "front-core-runtime-style";
const SSR_SHELL_ID = "ssr-shell";
const SSR_CONTROL_PANEL_ROOT_ID = "ssr-control-panel-root";
const SSR_RIGHT_RAIL_ID = "ssr-right-rail";
const SSR_RAIL_RESIZER_ID = "ssr-rail-resizer";
const SSR_CHAT_DOCK_ID = "ssr-chat-dock";
const SSR_CHAT_INPUT_ID = "ssr-chat-input";
const SSR_CHAT_ATTACH_ID = "ssr-chat-attach";
const SSR_CHAT_FORM_ID = "ssr-chat-form";
const SSR_CHAT_QUICK_ID = "ssr-chat-quick";
const ENSURE_TEMPORARY_SESSION_ACTION = "auth.ensure-temporary-session";
const SSR_RAIL_WIDTH_STORAGE_KEY = "ssr_rail_width";
const SSR_RAIL_MIN_WIDTH = 280;
const SSR_RAIL_MAX_WIDTH = 680;
const SSR_RAIL_DEFAULT_WIDTH = 380;
let heroRequestCleanup: (() => void) | null = null;
let controlPanelModeUnwatch: (() => void) | null = null;
let menuTabBound = false;
const RIGHT_RAIL_QUERY_KEYS = [
	"sidebarTab",
	"sidebarPanel",
	"sidebarAction",
] as const;
type ControlPanelRuntimeHandle = {
	setMode: (mode: ControlPanelMode) => void;
	unmount: () => void;
};
type QuickChatPrompt =
	| string
	| {
			label?: string;
			message?: string;
			prompt?: string;
			contextName?: string;
			icon?: string;
	  };

const QUICK_CHAT_PROMPTS = [
	{
		label: "Start CNC request",
		message: "I need CNC machining. Help me create a request.",
		contextName: CHAT_CONTEXT,
		icon: "FileText",
	},
	{
		label: "What files to upload?",
		message:
			"What files and parameters should I prepare for a CNC machining quote?",
		contextName: CHAT_CONTEXT,
		icon: "ClipboardList",
	},
	{
		label: "I have STEP files",
		message:
			"I have STEP files for parts. Start a machining request and tell me what else is needed.",
		contextName: CHAT_CONTEXT,
		icon: "Factory",
	},
	{
		label: "Ask missing questions",
		message: "Ask me the missing questions for a CNC machining request.",
		contextName: CHAT_CONTEXT,
		icon: "BadgeHelp",
	},
] as const;
const QUICK_CHAT_ICON: Record<string, string> = {
	BadgeHelp:
		'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.78 4.78 4 4 0 0 1-6.74 0 4 4 0 0 1-4.78-4.78 4 4 0 0 1 0-6.75Z"/><path d="M9.1 9a3 3 0 0 1 5.82 1c0 2-3 2-3 4"/><path d="M12 17h.01"/></svg>',
	ClipboardList:
		'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6"/><path d="M9 16h6"/></svg>',
	Factory:
		'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20h20"/><path d="M3 20V8l7 5V8l7 5V4h4v16"/><path d="M13 18h2"/><path d="M18 18h1"/><path d="M8 18h2"/></svg>',
	FileText:
		'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>',
	Sparkles:
		'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9.9 10.8 8 16l-1.9-5.2L1 9l5.1-1.8L8 2l1.9 5.2L15 9l-5.1 1.8Z"/><path d="m19 14 1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3Z"/></svg>',
	Truck:
		'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H3v14h2"/><path d="M15 18H9"/><path d="M19 18h2v-5l-3-5h-4"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>',
	UserPlus:
		'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/></svg>',
	Users:
		'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
	Workflow:
		'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="8" x="3" y="3" rx="2"/><rect width="8" height="8" x="13" y="13" rx="2"/><path d="M7 11v4a2 2 0 0 0 2 2h4"/><path d="M11 7h4a2 2 0 0 1 2 2v4"/></svg>',
};
const MODULES_LIST_FOR_USER_PATH = "/services/modules/listForUser";
const CONTROL_ICON = {
	login:
		'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/></svg>',
	logout:
		'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4"/><path d="M14 7l5 5-5 5"/><path d="M19 12H8"/></svg>',
	sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>',
	moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a7 7 0 1 0 9 9 9 9 0 1 1-9-9z"/></svg>',
	maximize:
		'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>',
	minimize:
		'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H3v5"/><path d="M16 21h5v-5"/><path d="M3 8l7 7"/><path d="M21 16l-7-7"/></svg>',
	panelOpen:
		'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v16"/><path d="m14 9 3 3-3 3"/></svg>',
	panelClose:
		'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v16"/><path d="m17 9-3 3 3 3"/></svg>',
} as const;
let pendingNavigation: AbortController | null = null;
let linkInterceptorDocumentPath: string | null = null;
let stopMenuWatch: (() => void) | null = null;
const groupLoadPromises = new Map<string, Promise<void>>();
const loadedModules = new Set<string>();
const loadedGroupMenus: Record<string, any[]> = {};
let preferredOpenGroupId: string | null = null;
let centerRendererInitPromise: Promise<void> | null = null;
let centerRenderWatchStop: (() => void) | null = null;
let centerRenderHost: HTMLElement | null = null;
let centerRenderRoot: {
	render: (node: any) => void;
	unmount: () => void;
} | null = null;
let controlPanelInitPromise: Promise<void> | null = null;
let controlPanelHost: HTMLElement | null = null;
let controlPanelRuntime: ControlPanelRuntimeHandle | null = null;
let controlsBound = false;
let railTabsBound = false;
let railResizerBound = false;
let chatDockBound = false;
let landingEventGatewayBound = false;
let chatDockGeometryBound = false;
let chatDockResizeObserver: ResizeObserver | null = null;
let railWide = false;
let visibleGroupIds: Set<string> | null = null;
let allowedMicrofrontendsCacheKey: string | null = null;
let allowedMicrofrontendsCache: string[] | null = null;
let allowedMicrofrontendsPromise: Promise<string[] | null> | null = null;
type CenterViewState = ReturnType<typeof $centerView.getState>;

function getControl(name: string): HTMLButtonElement | null {
	return document.querySelector<HTMLButtonElement>(
		`[data-ssr-control="${name}"]`,
	);
}

function setControlIcon(button: HTMLButtonElement | null, icon: string): void {
	if (!button) return;
	button.innerHTML = icon;
}

function isDarkTheme(): boolean {
	return document.documentElement.classList.contains("dark");
}

function isAuthenticated(): boolean {
	return authToken.isAuthenticated();
}

function isRightRailOpen(): boolean {
	const rail = document.getElementById(SSR_RIGHT_RAIL_ID);
	return rail?.dataset.open === "1";
}

function clampSsrRailWidth(width: number): number {
	return Math.round(
		Math.max(SSR_RAIL_MIN_WIDTH, Math.min(SSR_RAIL_MAX_WIDTH, width)),
	);
}

function getCurrentSsrRailWidth(): number {
	const rail = document.getElementById(SSR_RIGHT_RAIL_ID);
	const rectWidth = rail?.getBoundingClientRect().width ?? 0;
	if (Number.isFinite(rectWidth) && rectWidth > 0) {
		return clampSsrRailWidth(rectWidth);
	}

	const shell = document.getElementById(SSR_SHELL_ID);
	const raw = window
		.getComputedStyle(shell ?? document.documentElement)
		.getPropertyValue("--ssr-rail-width")
		.trim();
	const parsed = Number.parseFloat(raw);
	return clampSsrRailWidth(
		Number.isFinite(parsed) ? parsed : SSR_RAIL_DEFAULT_WIDTH,
	);
}

function applySsrRailWidth(width: number, persist = false): number {
	const nextWidth = clampSsrRailWidth(width);
	const value = `${nextWidth}px`;
	document.documentElement.style.setProperty("--ssr-rail-width", value);
	document
		.getElementById(SSR_SHELL_ID)
		?.style.setProperty("--ssr-rail-width", value);
	document
		.getElementById("app-shell")
		?.style.setProperty("--ssr-rail-width", value);

	if (persist) {
		try {
			window.localStorage.setItem(
				SSR_RAIL_WIDTH_STORAGE_KEY,
				String(nextWidth),
			);
		} catch {
			// localStorage can be unavailable in restricted browser modes.
		}
	}

	return nextWidth;
}

function restoreSsrRailWidth(): void {
	try {
		const stored = window.localStorage.getItem(SSR_RAIL_WIDTH_STORAGE_KEY);
		if (!stored) return;
		const parsed = Number.parseFloat(stored);
		if (!Number.isFinite(parsed)) return;
		applySsrRailWidth(parsed);
	} catch {
		// ignore storage errors
	}
}

function updateShellWidthMode(): void {
	const value = railWide ? "1" : "0";
	document.getElementById(SSR_SHELL_ID)?.setAttribute("data-rail-wide", value);
	document.getElementById("app-shell")?.setAttribute("data-rail-wide", value);
}

function refreshControlStates(): void {
	const auth = getControl("auth");
	const theme = getControl("theme");
	const constrain = getControl("constrain");
	const rail = getControl("rail");

	if (auth) {
		const authed = isAuthenticated();
		auth.setAttribute("aria-label", authed ? "Log out" : "Open login");
		setControlIcon(auth, authed ? CONTROL_ICON.logout : CONTROL_ICON.login);
	}

	if (theme) {
		const dark = isDarkTheme();
		theme.setAttribute(
			"aria-label",
			dark ? "Switch to light mode" : "Switch to dark mode",
		);
		setControlIcon(theme, dark ? CONTROL_ICON.sun : CONTROL_ICON.moon);
	}

	if (constrain) {
		constrain.setAttribute("aria-pressed", railWide ? "true" : "false");
		constrain.setAttribute(
			"aria-label",
			railWide ? "Reduce panel width" : "Expand panel width",
		);
		setControlIcon(
			constrain,
			railWide ? CONTROL_ICON.minimize : CONTROL_ICON.maximize,
		);
	}

	if (rail) {
		const open = isRightRailOpen();
		rail.setAttribute("aria-pressed", open ? "true" : "false");
		rail.setAttribute("aria-label", open ? "Collapse panel" : "Show panel");
		setControlIcon(
			rail,
			open ? CONTROL_ICON.panelClose : CONTROL_ICON.panelOpen,
		);
	}
}

function applyTheme(next: "light" | "dark"): void {
	localStorage.setItem("theme", next);
	document.documentElement.classList.toggle("dark", next === "dark");
	document.documentElement.style.colorScheme = next;
}

function applyControlPanelMode(mode: ControlPanelMode): void {
	const value = mode;
	document
		.getElementById(SSR_SHELL_ID)
		?.setAttribute("data-control-panel-mode", value);
	document
		.getElementById("app-shell")
		?.setAttribute("data-control-panel-mode", value);
	document
		.getElementById(SSR_CONTROL_PANEL_ROOT_ID)
		?.setAttribute("data-mode", value);
	if (value === "app") {
		resetHeroInputDock();
	}
}

function getAppliedControlPanelMode(): ControlPanelMode {
	return readControlPanelMode();
}

function readGuestMenuItems(): RuntimeMenuItem[] {
	const initial = readInitialData();
	return Array.isArray(initial.guestMenu) ? initial.guestMenu : [];
}

function readGuestMenuLinks(): ControlPanelMenuLink[] {
	return readGuestMenuItems().flatMap((item): ControlPanelMenuLink[] => {
		const label = typeof item.title === "string" ? item.title.trim() : "";
		const href =
			typeof item.href === "string" && item.href.trim()
				? item.href.trim()
				: typeof (item as { url?: unknown }).url === "string" &&
						(item as { url: string }).url.trim()
					? (item as { url: string }).url.trim()
					: "";
		const labelKey =
			typeof item.labelKey === "string" && item.labelKey.trim()
				? item.labelKey.trim()
				: undefined;
		return label && href
			? [{ label, href, ...(labelKey ? { labelKey } : {}) }]
			: [];
	});
}

function hasInitialPublicContent(): boolean {
	const initial = readInitialData();
	return Boolean(
		readGuestMenuItems().length > 0 ||
			initial.landing ||
			(initial as { docsContent?: unknown }).docsContent,
	);
}

function resolveInitialControlPanelMode(): ControlPanelMode {
	if (getAppliedControlPanelMode() === "app") return "app";
	if (hasRightRailDeepLink()) return "app";
	if (!isAuthenticated() && hasInitialPublicContent()) return "public";
	if (isSsrPublicRoute(window.location.pathname)) return "public";
	return "app";
}

function resolveAuthChangedControlPanelMode(): ControlPanelMode {
	const current = getAppliedControlPanelMode();
	if (isSsrPublicRoute(window.location.pathname)) return current;
	return "app";
}

function setControlPanelMode(mode: ControlPanelMode): void {
	if (mode === "app") {
		controlPanelOpened();
	} else {
		controlPanelClosed();
	}
	if (mode === "app") {
		installDynamicMenuIfReady();
	}
}

function extractRequestIdForConsolePath(pathname: string): string | null {
	const segments = pathname.split("/").filter(Boolean);
	if (segments[0] === "request" && segments[1]) {
		return decodeURIComponent(segments[1]);
	}
	if (segments[0] === "console" && segments[1] === "request" && segments[2]) {
		return decodeURIComponent(segments[2]);
	}
	if (segments[1] === "request" && segments[2]) {
		return decodeURIComponent(segments[2]);
	}
	if (segments[1] === "console" && segments[2] === "request" && segments[3]) {
		return decodeURIComponent(segments[3]);
	}
	return null;
}

export function switchToAppMode(): void {
	if (typeof window !== "undefined" && isAuthenticated()) {
		const url = new URL(window.location.href);
		if (url.pathname !== "/console" && !url.pathname.startsWith("/console/")) {
			const requestId = extractRequestIdForConsolePath(url.pathname);
			url.pathname = requestId
				? `/console/request/${encodeURIComponent(requestId)}`
				: "/console";
			window.history.replaceState(
				window.history.state,
				"",
				`${url.pathname}${url.search}${url.hash}`,
			);
		}
	}
	controlPanelOpened();
}

function isConsoleRoutePath(pathname: string): boolean {
	return pathname === "/console" || pathname.startsWith("/console/");
}

// Set by the pre-paint auth bootstrap (ssr-shell) when a real auth token arrives
// in the callback URL — i.e. the user just signed in. Consumed once so a later
// reload of a public page does not re-enter the console.
function consumeFreshLogin(): boolean {
	if (typeof window === "undefined") return false;
	try {
		if (window.sessionStorage.getItem("freshLogin") === "1") {
			window.sessionStorage.removeItem("freshLogin");
			return true;
		}
	} catch {
		// ignore storage access errors
	}
	return false;
}

// Rewrite the URL to /console (preserving a deep-linked request id) regardless
// of auth state, so the console is a real, shareable/reloadable route.
function goToConsoleUrl(): void {
	if (
		typeof window === "undefined" ||
		isConsoleRoutePath(window.location.pathname)
	) {
		return;
	}
	const url = new URL(window.location.href);
	const requestId = extractRequestIdForConsolePath(url.pathname);
	url.pathname = requestId
		? `/console/request/${encodeURIComponent(requestId)}`
		: "/console";
	window.history.replaceState(
		window.history.state,
		"",
		`${url.pathname}${url.search}${url.hash}`,
	);
}

// Present the sign-in form in the side panel (auth tab) of the app shell.
async function showAuthPanel(): Promise<void> {
	await ensureControlPanelRuntime();
	ensureAuthTabMounted();
	tabActivated("auth");
	await presentAuthLogin();
}

// Enter the /console route in app mode. When authenticated we render the live
// state stream; otherwise we render a splash placeholder and open the sign-in
// panel on the side — the console is still a real route, just gated.
function enterConsole(): void {
	goToConsoleUrl();
	switchToAppMode();
	if (isAuthenticated()) {
		setCenterView({ view: StateStreamView });
		void ensureSsrCenterRuntime();
	} else {
		setCenterView({ view: ConsoleAuthSplash });
		void ensureSsrCenterRuntime();
		void showAuthPanel();
	}
}

// Shared landing boot for the console. We enter it when the user is already on a
// /console route (authenticated → stream, otherwise → splash + sign-in) or right
// after a sign-in. Authenticated users on a public page (e.g. "/") are left
// untouched instead of being force-redirected. Safe to call once per landing
// entrypoint; the auth listener is bound at most once.
let consoleAutoEntryBound = false;
export function initConsoleAutoEntry(): void {
	if (typeof window === "undefined") return;
	const onConsole = isConsoleRoutePath(window.location.pathname);
	if (onConsole || (isAuthenticated() && consumeFreshLogin())) {
		enterConsole();
	}
	if (!consoleAutoEntryBound) {
		consoleAutoEntryBound = true;
		window.addEventListener("auth-token-changed", () => {
			// Sign-in (real, non-temporary session) → open the console. Logout while
			// inside the console falls back to the splash + sign-in panel. Anonymous
			// or temporary sessions on a public page leave the current view untouched.
			if (isAuthenticated() || isConsoleRoutePath(window.location.pathname)) {
				enterConsole();
			}
		});
	}
}

function installDynamicMenuIfReady(): void {
	const menuPanel = document.getElementById("ssr-left-panel");
	if (!menuPanel || menuPanel.dataset.ssrMenuShell === "1") return;
	menuPanel.dataset.ssrMenuShell = "1";
	installDynamicMenu(menuPanel);
}

async function ensureMenuStoreReady(): Promise<void> {
	if (!isAuthenticated()) {
		return;
	}

	const names = await discoverMicrofrontends();
	const groupIds = Array.from(new Set(names.map((name) => getMfGroup(name))));
	await Promise.all(groupIds.map((groupId) => ensureGroupLoaded(groupId)));
}

function bindMenuTabActivation(): void {
	if (menuTabBound) return;
	menuTabBound = true;
	tabActivated.watch((id) => {
		if (id !== MENU_TAB_ID) return;
		void ensureMenuStoreReady();
	});
}

function resetHeroInputDock(): void {
	document
		.querySelector<HTMLElement>(".hsl-hero-input")
		?.classList.remove("hsl-hero-input--docked");
	delete document.documentElement.dataset.heroInputDocked;

	const panel = document.getElementById(SSR_CONTROL_PANEL_ROOT_ID);
	if (!panel) return;
	for (const property of [
		"height",
		"background",
		"backdrop-filter",
		"-webkit-backdrop-filter",
		"border-bottom",
		"box-shadow",
		"transition",
	]) {
		panel.style.removeProperty(property);
	}
}

function ensureControlPanelModeBinding(): void {
	if (controlPanelModeUnwatch) return;
	controlPanelModeUnwatch = $controlPanelMode.watch((mode) => {
		applyControlPanelMode(mode);
		if (mode === "app") {
			installDynamicMenuIfReady();
		}
	});
}

// Gallery static files are served through the runtime /images/* route, not
// directly from ms-galery: a direct browser GET carries no workspace header, so
// on multi-tenant prod the scoped store can't be resolved. /images/* is
// cache-first and resolves the tenant server-side.
function normalizeGalleryStaticUrl(value: string, fallback: string): string {
	const resolved = value || fallback;
	const marker = "/galery/static/";
	const idx = resolved.indexOf(marker);
	return idx >= 0
		? `/images/${resolved.slice(idx + marker.length)}`
		: resolved;
}

type ControlPanelMenuLink = {
	label: string;
	href: string;
	labelKey?: string;
};

function readTrimmedString(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function readLandingBlockNavLabel(block: unknown): string {
	if (!block || typeof block !== "object") return "";
	const record = block as Record<string, unknown>;
	const props =
		record.props && typeof record.props === "object"
			? (record.props as Record<string, unknown>)
			: {};
	const explicit = readTrimmedString(props.navLabel);
	if (explicit) return explicit;

	const data =
		record.data && typeof record.data === "object"
			? (record.data as Record<string, unknown>)
			: {};
	for (const source of Object.values(data)) {
		if (!source || typeof source !== "object") continue;
		const sourceRecord = source as Record<string, unknown>;
		const navLabel = readTrimmedString(sourceRecord.navLabel);
		if (navLabel) return navLabel;
		const title = readTrimmedString(sourceRecord.title);
		if (title) return title;
		const railLabel = readTrimmedString(sourceRecord.railLabel);
		if (railLabel) return railLabel;
		const headline = readTrimmedString(sourceRecord.headline);
		if (headline) return headline;
	}

	return "";
}

function createLandingBlockLabelMap(blocks: unknown): Map<string, string> {
	const map = new Map<string, string>();
	if (!Array.isArray(blocks)) return map;

	blocks.forEach((block) => {
		if (!block || typeof block !== "object") return;
		const id = readTrimmedString((block as Record<string, unknown>).id);
		const label = readLandingBlockNavLabel(block);
		if (id && label) {
			map.set(id, label);
		}
	});

	return map;
}

function normalizeControlPanelMenuLinks(
	value: unknown,
	blockLabels = new Map<string, string>(),
): ControlPanelMenuLink[] {
	if (!Array.isArray(value)) return [];
	return value.flatMap((item): ControlPanelMenuLink[] => {
		if (!item || typeof item !== "object") return [];
		const record = item as Record<string, unknown>;
		const explicitLabel = readTrimmedString(record.label);
		const explicitHref =
			typeof record.href === "string" ? record.href.trim() : "";
		const targetId =
			typeof record.blockId === "string" && record.blockId.trim()
				? record.blockId.trim()
				: typeof record.sectionId === "string" && record.sectionId.trim()
					? record.sectionId.trim()
					: typeof record.targetId === "string" && record.targetId.trim()
						? record.targetId.trim()
						: "";
		const href =
			explicitHref || (targetId ? `#${targetId.replace(/^#/, "")}` : "");
		const label =
			explicitLabel || (targetId ? (blockLabels.get(targetId) ?? "") : "");
		const labelKey = readTrimmedString(record.labelKey) || undefined;
		return label && href
			? [{ label, href, ...(labelKey ? { labelKey } : {}) }]
			: [];
	});
}

function parseControlPanelMenuLinks(
	value: string | undefined,
): ControlPanelMenuLink[] {
	if (!value) return [];

	try {
		const parsed = JSON.parse(value) as unknown;
		return normalizeControlPanelMenuLinks(parsed);
	} catch {
		return [];
	}
}

function readControlPanelMenuLinksFromInitialData(): ControlPanelMenuLink[] {
	const landing = readInitialData().landing;
	if (!landing || typeof landing !== "object") return [];

	for (const payload of Object.values(landing as Record<string, unknown>)) {
		if (!payload || typeof payload !== "object") continue;
		const navigation = (payload as { navigation?: unknown }).navigation;
		if (!navigation || typeof navigation !== "object") continue;
		const blockLabels = createLandingBlockLabelMap(
			(payload as { blocks?: unknown }).blocks,
		);
		const links = normalizeControlPanelMenuLinks(
			(navigation as { menuLinks?: unknown }).menuLinks,
			blockLabels,
		);
		if (links.length > 0) return links;
	}

	return [];
}

function resolveLandingConfigPathFromInitialData(): string | null {
	const landingEnv = readInitialData().mfEnv?.["mf-landing"];
	if (!landingEnv || typeof landingEnv !== "object") return null;
	const configPath = (landingEnv as { landingConfId?: unknown }).landingConfId;
	return typeof configPath === "string" && configPath.trim()
		? configPath.trim()
		: null;
}

async function loadControlPanelMenuLinks(
	current: ControlPanelMenuLink[],
): Promise<ControlPanelMenuLink[]> {
	if (current.length > 0) return current;

	const initialLinks = readControlPanelMenuLinksFromInitialData();
	if (initialLinks.length > 0) return initialLinks;

	const guestMenuLinks = readGuestMenuLinks();
	if (guestMenuLinks.length > 0) return guestMenuLinks;

	const configPath = resolveLandingConfigPathFromInitialData();
	if (!configPath) return current;

	try {
		const landingPayload = Object.values(readInitialData().landing ?? {})[0];
		const blockLabels = createLandingBlockLabelMap(
			landingPayload && typeof landingPayload === "object"
				? (landingPayload as { blocks?: unknown }).blocks
				: undefined,
		);
		const data = (await structClient.readJson(configPath)) as {
			navigation?: { menuLinks?: unknown };
		};
		const links = normalizeControlPanelMenuLinks(
			data?.navigation?.menuLinks,
			blockLabels,
		);
		return links.length > 0 ? links : current;
	} catch {
		return current;
	}
}

function readControlPanelHostOptions(host: HTMLElement) {
	const locale = resolveRuntimeLocale(window.location.pathname);
	return {
		logoLight: normalizeGalleryStaticUrl(
			host.dataset.logoLight || "",
			"/header-logo-black.svg",
		),
		logoDark: normalizeGalleryStaticUrl(
			host.dataset.logoDark || "",
			"/header-logo-white.svg",
		),
		phone: host.dataset.phone || undefined,
		statusText: host.dataset.statusText || undefined,
		// Website-call context alias (NOT a phone). Configurable per landing via
		// data-context-name; drives the web-call (voice) context, defaults to VOICE_CONTEXT.
		contextName: host.dataset.contextName || VOICE_CONTEXT,
		chatPlaceholder:
			host.dataset.chatPlaceholder || "Describe your CNC request...",
		menuLinks: parseControlPanelMenuLinks(host.dataset.menuLinks),
		loginEnabled: host.dataset.loginEnabled !== "0",
		currentLanguage: locale,
	};
}

async function ensureControlPanelRuntime(): Promise<void> {
	ensureControlPanelModeBinding();
	const host = document.getElementById(SSR_CONTROL_PANEL_ROOT_ID);
	if (!host) return;

	const previousHost = controlPanelHost;
	if (controlPanelInitPromise && previousHost === host) {
		return controlPanelInitPromise;
	}

	controlPanelHost = host;
	controlPanelInitPromise = (async () => {
		if (controlPanelRuntime && previousHost !== host) {
			controlPanelRuntime.unmount();
			controlPanelRuntime = null;
		}

		const [{ mountControlPanelRuntime }] = await Promise.all([
			import("./control-panel-runtime"),
		]);
		bindLoginTabActivation();
		const hostOptions = readControlPanelHostOptions(host);
		const menuLinks = await loadControlPanelMenuLinks(hostOptions.menuLinks);
		const localeRouting = readInitialLocaleRouting();
		const initialMode = resolveInitialControlPanelMode();
		controlPanelModeChanged(initialMode);
		bindMenuTabActivation();
		controlPanelRuntime = mountControlPanelRuntime(host, {
			logoLight: hostOptions.logoLight,
			logoDark: hostOptions.logoDark,
			phone: hostOptions.phone,
			statusText: hostOptions.statusText,
			contextName: hostOptions.contextName,
			chatPlaceholder: hostOptions.chatPlaceholder,
			menuLinks,
			loginEnabled: hostOptions.loginEnabled,
			languages:
				localeRouting.mode === "single"
					? []
					: AVAILABLE_LANGS.map((lang) => ({
							code: lang.code,
							label: lang.code.toUpperCase(),
						})),
			currentLanguage: hostOptions.currentLanguage,
			isDark: isDarkTheme(),
			isAuthenticated,
			onAppModeRendered: installDynamicMenuIfReady,
			onOpenChat: (message) => {
				void openAiChat(message, { contextName: CHAT_CONTEXT });
			},
			onAttach: () => {
				void openAiChat(undefined, { contextName: CHAT_CONTEXT }).then(() =>
					chatAttachRequested(),
				);
			},
			onLogin: () => {
				void openLoginPanel();
			},
			onLogout: () => {
				window.localStorage.removeItem("authToken");
				window.dispatchEvent(new Event("auth-token-changed"));
			},
			onThemeToggle: () => {
				const next = isDarkTheme() ? "light" : "dark";
				applyTheme(next);
				return next === "dark";
			},
			onLanguage: (code) => {
				void applyLocaleChange(code);
			},
			tabs: hostOptions.loginEnabled
				? [
						{
							id: "auth",
							icon: createElement(KeyRound, { size: 17 }),
							label: "Sign in",
						},
					]
				: [],
		});
		if (readControlPanelMode() === "app") {
			installDynamicMenuIfReady();
		}
	})();

	return controlPanelInitPromise;
}

async function ensureAuthLoaded(): Promise<void> {
	const moduleName = "mf-auth";
	if (loadedModules.has(moduleName)) return;
	initMicrofrontendEnv();
	try {
		const runtime = await import(/* @vite-ignore */ moduleName);
		if (!loadedModules.has(moduleName) && runtime?.default?.plug) {
			runtime.default.plug(bus);
			loadedModules.add(moduleName);
		}
	} catch (error) {
		console.error("[ssr-menu] failed to load mf-auth", error);
	}
}

async function ensureTemporarySessionForChat(): Promise<void> {
	await ensureAuthLoaded();
	const action = registry.get(ENSURE_TEMPORARY_SESSION_ACTION);
	if (!action) return;
	await action.invoke(undefined);
}

function ensureAuthTabMounted(): void {
	tabContentRegistered({
		id: "auth",
		content: createElement(SlotInline, { slotId: "sidebar:tab:auth" }),
	});
}

let authLoginPresentationPromise: Promise<void> | null = null;
async function presentAuthLogin(): Promise<void> {
	if (authLoginPresentationPromise) {
		return authLoginPresentationPromise;
	}
	authLoginPresentationPromise = (async () => {
		ensureAuthTabMounted();
		await ensureAuthLoaded();
		await Promise.resolve();
		await Promise.resolve();
		rightRailActionSelected("auth.show-login");
		runActionEvent({ actionId: "auth.show-login", params: {} });
	})().finally(() => {
		authLoginPresentationPromise = null;
	});
	return authLoginPresentationPromise;
}

export async function openLoginPanel(): Promise<void> {
	// Clicking "login" always routes to /console. If already authenticated this
	// shows the console; otherwise it shows the splash + the side sign-in panel.
	enterConsole();
}

// The auth tab is hidden until login is requested. At that point we register an
// inline tab host, then let mf-auth present into "sidebar:tab:auth".
let loginTabBound = false;
function bindLoginTabActivation(): void {
	if (loginTabBound) return;
	loginTabBound = true;
	tabActivated.watch((id) => {
		if (id !== "auth") return;
		void presentAuthLogin();
	});
}

function installPanelControls(): void {
	if (controlsBound) {
		refreshControlStates();
		return;
	}

	const auth = getControl("auth");
	const theme = getControl("theme");
	const constrain = getControl("constrain");
	const rail = getControl("rail");
	if (!auth && !theme && !constrain && !rail) return;

	controlsBound = true;

	auth?.addEventListener("click", () => {
		if (isAuthenticated()) {
			window.localStorage.removeItem("authToken");
			window.dispatchEvent(new Event("auth-token-changed"));
			refreshControlStates();
			return;
		}
		void openLoginPanel();
	});

	theme?.addEventListener("click", () => {
		applyTheme(isDarkTheme() ? "light" : "dark");
		refreshControlStates();
	});

	constrain?.addEventListener("click", () => {
		railWide = !railWide;
		updateShellWidthMode();
		refreshControlStates();
	});

	rail?.addEventListener("click", () => {
		const next = !isRightRailOpen();
		setRightRailOpen(next);
		if (
			next &&
			document.getElementById(SSR_RIGHT_RAIL_ID)?.dataset.mode !== "tab"
		) {
			setRightRailMode("chat");
		}
		refreshControlStates();
	});

	window.addEventListener("auth-token-changed", refreshControlStates);
	window.addEventListener("storage", refreshControlStates);

	updateShellWidthMode();
	refreshControlStates();
}

function installSsrRailResizer(): void {
	const resizer = document.getElementById(
		SSR_RAIL_RESIZER_ID,
	) as HTMLButtonElement | null;
	if (!resizer) return;

	restoreSsrRailWidth();

	if (resizer.dataset.resizeBound === "1") return;
	if (railResizerBound) return;
	railResizerBound = true;
	resizer.dataset.resizeBound = "1";

	resizer.addEventListener("pointerdown", (event) => {
		const shell = document.getElementById(SSR_SHELL_ID);
		if (!shell || window.matchMedia("(max-width: 980px)").matches) return;
		if (shell.dataset.railOpen !== "1" && shell.dataset.chatFocus !== "1") {
			return;
		}

		event.preventDefault();
		event.stopPropagation();

		const startX = event.clientX;
		const startWidth = getCurrentSsrRailWidth();
		const previousUserSelect = document.body.style.userSelect;
		const previousCursor = document.body.style.cursor;
		const appShell = document.getElementById("app-shell");

		document.body.style.userSelect = "none";
		document.body.style.cursor = "col-resize";
		shell.dataset.railResizing = "1";
		appShell?.setAttribute("data-rail-resizing", "1");

		try {
			resizer.setPointerCapture(event.pointerId);
		} catch {
			// Safari may reject capture after a fast pointer transition.
		}

		const onPointerMove = (moveEvent: globalThis.PointerEvent) => {
			moveEvent.preventDefault();
			applySsrRailWidth(startWidth + moveEvent.clientX - startX);
		};

		const cleanup = () => {
			applySsrRailWidth(getCurrentSsrRailWidth(), true);
			document.body.style.userSelect = previousUserSelect;
			document.body.style.cursor = previousCursor;
			delete shell.dataset.railResizing;
			appShell?.removeAttribute("data-rail-resizing");
			try {
				resizer.releasePointerCapture(event.pointerId);
			} catch {
				// ignore
			}
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerup", onPointerUp);
			window.removeEventListener("pointercancel", onPointerCancel);
		};

		const onPointerUp = () => cleanup();
		const onPointerCancel = () => cleanup();

		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp);
		window.addEventListener("pointercancel", onPointerCancel);
	});
}

async function ensureCenterRenderer(): Promise<void> {
	const host = document.getElementById("root");
	if (!host) return;
	const main = host.closest("#ssr-main") as HTMLElement | null;
	if (main) {
		main.setAttribute("data-center-runtime", "1");
	}
	host.setAttribute("data-center-runtime", "1");

	if (
		centerRendererInitPromise &&
		centerRenderHost === host &&
		centerRenderHost.isConnected &&
		centerRenderRoot
	) {
		return centerRendererInitPromise;
	}

	centerRendererInitPromise = (async () => {
		if (centerRenderRoot && centerRenderHost !== host) {
			try {
				centerRenderRoot.unmount();
			} catch {
				// ignore unmount errors
			}
			centerRenderRoot = null;
		}

		const [{ createElement }, reactDom] = await Promise.all([
			import("react"),
			import("react-dom/client"),
		]);
		const nextRoot = reactDom.createRoot(host);
		centerRenderHost = host;
		centerRenderRoot = nextRoot;

		const renderCenter = (centerView: CenterViewState) => {
			if (!centerView || !centerRenderRoot) return;
			const View = centerView.view as any;
			centerRenderRoot.render(
				createElement(
					"div",
					{ className: "ssr-center-runtime" },
					createElement(View, centerView.config ?? {}),
				),
			);
		};

		renderCenter(($centerView.getState?.() as CenterViewState) ?? null);

		if (!centerRenderWatchStop) {
			const watchResult = $centerView.watch((next) => {
				renderCenter((next as CenterViewState) ?? null);
			});
			centerRenderWatchStop =
				typeof watchResult === "function"
					? watchResult
					: () => (watchResult as { unsubscribe?: () => void }).unsubscribe?.();
		}
	})();

	return centerRendererInitPromise;
}

export async function ensureSsrCenterRuntime(): Promise<void> {
	await ensureCenterRenderer();
}

function setRightRailMode(mode: "chat" | "tab"): void {
	const rail = document.getElementById(SSR_RIGHT_RAIL_ID);
	if (!rail) return;
	rail.dataset.mode = mode;
	refreshRightRailTabs();
}

function setRightRailOpen(open: boolean): void {
	const rail = document.getElementById(SSR_RIGHT_RAIL_ID);
	const appShell = document.getElementById("app-shell");
	const shell = document.getElementById(SSR_SHELL_ID);
	const next = open ? "1" : "0";
	if (rail) {
		rail.dataset.open = next;
	}
	if (shell) {
		shell.dataset.railOpen = next;
	}
	if (appShell) {
		appShell.dataset.railOpen = next;
	}
	refreshControlStates();
	refreshRightRailTabs();
}

function refreshRightRailTabs(): void {
	const rail = document.getElementById(SSR_RIGHT_RAIL_ID);
	if (!rail) return;
	const mode = rail.dataset.mode === "tab" ? "tab" : "chat";
	const chat = rail.querySelector<HTMLButtonElement>(
		'[data-ssr-rail-tab="chat"]',
	);
	const tab = rail.querySelector<HTMLButtonElement>(
		'[data-ssr-rail-tab="tab"]',
	);
	if (chat) {
		chat.setAttribute("aria-pressed", mode === "chat" ? "true" : "false");
	}
	if (tab) {
		tab.setAttribute("aria-pressed", mode === "tab" ? "true" : "false");
	}
}

function installRightRailTabs(): void {
	const rail = document.getElementById(SSR_RIGHT_RAIL_ID);
	if (!rail) return;
	const chat = rail.querySelector<HTMLButtonElement>(
		'[data-ssr-rail-tab="chat"]',
	);
	const tab = rail.querySelector<HTMLButtonElement>(
		'[data-ssr-rail-tab="tab"]',
	);
	if (!chat && !tab) return;

	if (!railTabsBound) {
		railTabsBound = true;
		chat?.addEventListener("click", () => {
			setRightRailOpen(true);
			setRightRailMode("chat");
			void ensureRightRailRuntime()
				.then(() => ensureAssistantsLoaded())
				.then(() => ensureTemporarySessionForChat())
				.then(() => {
					runActionEvent({ actionId: "chats.show", params: {} });
				});
		});
		tab?.addEventListener("click", () => {
			setRightRailOpen(true);
			setRightRailMode("tab");
		});
	}

	refreshRightRailTabs();
}

function syncRightRailMode(tabId: string | null | undefined): void {
	if (tabId && tabId !== "menu") {
		setRightRailOpen(true);
		setRightRailMode("tab");
		return;
	}
	setRightRailMode("chat");
}

async function ensureAssistantsLoaded(): Promise<void> {
	const moduleName = "mf-assistants";
	if (loadedModules.has(moduleName)) return;

	initMicrofrontendEnv();

	try {
		const runtime = await import(/* @vite-ignore */ moduleName);
		const groupId = getMfGroup(moduleName);

		if (!loadedModules.has(moduleName) && runtime?.default?.plug) {
			runtime.default.plug(bus);
			loadedModules.add(moduleName);
		}

		if (runtime?.MENU) {
			if (addGroupMenuOnce(groupId, moduleName, runtime, runtime.MENU)) {
				publishLoadedGroupsMenu();
			}
		}
	} catch (error) {
		console.error("[ssr-menu] failed to preload mf-assistants", error);
	}
}

async function ensureRightRailRuntime(): Promise<void> {
	setControlPanelMode("app");
	return ensureControlPanelRuntime();
}

const bridge = createBridgeController({
	onMenuAction: async (actionId) => {
		await Promise.all([ensureCenterRenderer(), ensureRightRailRuntime()]);
		rightRailActionSelected(actionId);
		runActionEvent({ actionId, params: {} });
	},
});

function ensureStyles(): void {
	if (document.getElementById(SSR_MENU_STYLE_ID)) return;
	const style = document.createElement("style");
	style.id = SSR_MENU_STYLE_ID;
	style.textContent = `
.ssr-panel-link {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  width: 100%;
  border: none;
  border-radius: 6px;
  text-decoration: none;
  color: inherit;
  background: transparent;
  padding: 0 12px;
  box-sizing: border-box;
  font-size: 15px;
  font-weight: 500;
}
.ssr-panel-link:hover {
  background: color-mix(in oklch, var(--ui-muted) 88%, transparent);
}
.ssr-menu-action {
  text-align: left;
  cursor: pointer;
}
.ssr-menu-tree {
  margin: 0;
}
.ssr-menu-tree > summary {
  list-style: none;
  cursor: pointer;
}
.ssr-menu-tree > summary::-webkit-details-marker {
  display: none;
}
.ssr-menu-chevron {
  width: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 14px;
  color: color-mix(in oklch, currentColor 72%, transparent);
}
.ssr-menu-chevron svg {
  width: 11px;
  height: 11px;
  display: block;
  transform-origin: 50% 50%;
  transition: transform 120ms ease;
}
.ssr-menu-tree[open] > summary .ssr-menu-chevron svg {
  transform: rotate(90deg);
}
.ssr-menu-chevron-empty svg {
  display: none;
}
.ssr-menu-icon {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  color: color-mix(in oklch, currentColor 84%, transparent);
}
.ssr-menu-icon svg {
  width: 16px;
  height: 16px;
  display: block;
}
.ssr-menu-icon-empty {
  color: transparent;
}
.ssr-menu-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ssr-menu-nested {
  margin: 0 0 0 4px;
  padding: 0;
}
#ssr-main[data-center-runtime="1"] {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 28px);
  height: calc(100vh - 28px);
  max-height: calc(100vh - 28px);
  min-width: 0;
  width: 100%;
  overflow: hidden;
}
#root[data-center-runtime="1"] {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  height: 100%;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
}
.ssr-center-runtime {
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  height: 100%;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
}
.ssr-center-runtime > * {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
}
#root[data-center-runtime="1"] .header-panel-logo {
  display: none !important;
}
#ssr-super-panel {
  min-height: 0;
  overflow: visible;
}
#ssr-shell[data-rail-resizing="1"],
#app-shell[data-rail-resizing="1"] {
  cursor: col-resize;
}
#ssr-shell[data-rail-resizing="1"],
#ssr-shell[data-rail-resizing="1"] #ssr-super-panel {
  transition: none;
}
#ssr-shell[data-rail-resizing="1"] #ssr-main {
  pointer-events: none;
}
#ssr-left-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden !important;
}
.ssr-panel-groups {
  overflow-y: auto;
  overflow-x: hidden;
}
#ssr-right-rail {
  display: flex;
  flex-direction: column;
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
#ssr-right-rail[data-mode="chat"] #ssr-right-rail-tab {
  display: none;
}
#ssr-right-rail[data-mode="tab"] #ssr-right-rail-chat {
  display: none;
}
@media (max-width: 980px) {
  #ssr-rail-resizer {
    display: none !important;
  }
}
#ssr-slot-provider-root {
  display: none;
}
#slot-panel-chat,
#slot-panel-tab {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  min-width: 0;
}
#slot-panel-chat > *,
#slot-panel-tab > * {
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
}

/* ── nav progress bar ── */
#ssr-nav-bar {
  position: fixed;
  top: 0;
  left: 0;
  height: 2px;
  width: 0%;
  background: var(--primary, #6366f1);
  z-index: 9999;
  transition: none;
  pointer-events: none;
  border-radius: 0 2px 2px 0;
}
#ssr-nav-bar.nav-running {
  transition: width 1.4s cubic-bezier(0.1, 0.05, 0.0, 1.0);
  width: 85%;
}
#ssr-nav-bar.nav-done {
  transition: width 0.15s ease-out, opacity 0.25s ease 0.15s;
  width: 100%;
  opacity: 0;
}

/* ── root leave (old content, menu not affected) ── */
#root.nav-leaving {
  transition: opacity 0.45s ease, filter 0.45s ease;
  opacity: 0.5;
  filter: blur(2px);
  pointer-events: none;
}

/* ── root enter (new content) ── */
#root.nav-entering {
  opacity: 0;
  transform: translateY(6px);
}
#root.nav-entered {
  transition: opacity 0.2s ease, transform 0.2s ease;
  opacity: 1;
  transform: translateY(0);
}
`;
	document.head.appendChild(style);
}

function ensureFrontCoreStyles(): void {
	if (document.getElementById(FRONT_CORE_STYLE_ID)) return;

	const link = document.createElement("link");
	link.id = FRONT_CORE_STYLE_ID;
	link.rel = "stylesheet";
	link.href = "/front-core.css";
	document.head.appendChild(link);
}

/* ── navigation progress ── */
let navBarEl: HTMLElement | null = null;
let navDoneTimer: ReturnType<typeof setTimeout> | null = null;

function getNavBar(): HTMLElement {
	if (!navBarEl) {
		navBarEl = document.createElement("div");
		navBarEl.id = "ssr-nav-bar";
		document.body.appendChild(navBarEl);
	}
	return navBarEl;
}

function navProgressStart(): void {
	const bar = getNavBar();
	if (navDoneTimer) {
		clearTimeout(navDoneTimer);
		navDoneTimer = null;
	}
	bar.className = "";
	bar.style.opacity = "1";
	bar.getBoundingClientRect();
	bar.className = "nav-running";

	const root = document.getElementById("root");
	if (root) {
		root.classList.remove("nav-entering", "nav-entered");
		root.getBoundingClientRect();
		root.classList.add("nav-leaving");
	}
}

function navProgressDone(): void {
	const bar = getNavBar();
	bar.className = "nav-done";
	navDoneTimer = setTimeout(() => {
		bar.className = "";
		bar.style.opacity = "1";
	}, 450);

	const root = document.getElementById("root");
	if (root) {
		root.classList.add("nav-entering");
		root.getBoundingClientRect();
		root.classList.replace("nav-entering", "nav-entered");
	}
}

function isInterceptableLink(
	link: HTMLAnchorElement,
	event: MouseEvent,
): boolean {
	if (event.defaultPrevented) return false;
	if (event.button !== 0) return false;
	if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
		return false;
	if (link.target && link.target !== "_self") return false;
	if (link.hasAttribute("download")) return false;

	const href = link.getAttribute("href");
	if (!href) return false;
	if (href.startsWith("#")) return false;
	if (
		href.startsWith("mailto:") ||
		href.startsWith("tel:") ||
		href.startsWith("javascript:")
	) {
		return false;
	}

	const url = new URL(link.href, window.location.href);
	if (url.origin !== window.location.origin) return false;
	return true;
}

function resolveEventElement(target: EventTarget | null): Element | null {
	if (target instanceof Element) return target;
	if (target instanceof Node) return target.parentElement;
	return null;
}

function extractRootFromHtml(html: string): HTMLElement | null {
	const parsed = new DOMParser().parseFromString(html, "text/html");
	const nextRoot = parsed.getElementById("root");
	if (!nextRoot) return null;
	document.title = parsed.title || document.title;
	return nextRoot;
}

function scrollToHashTarget(hash: string): void {
	const rawId = hash.replace(/^#/, "");
	if (!rawId) return;

	let id = rawId;
	try {
		id = decodeURIComponent(rawId);
	} catch {
		id = rawId;
	}

	document
		.getElementById(id)
		?.scrollIntoView({ behavior: "smooth", block: "start" });
}

type RuntimeMenuItem = {
	key?: string;
	title?: string;
	labelKey?: string;
	iconName?: string;
	icon?: ReactNode;
	action?: unknown;
	href?: string;
	__microfrontendId?: string;
	items?: RuntimeMenuItem[];
};

type InitialDataShape = {
	microfrontends?: string[];
	mfEnv?: Record<string, unknown>;
	guestMenu?: RuntimeMenuItem[];
	landing?: Record<string, unknown>;
};

const MENU_ICON_SVG: Record<string, string> = {
	IconBrain:
		'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 4a3 3 0 0 0-3 3v1.2a2.8 2.8 0 0 0 0 5.6V15a3 3 0 0 0 3 3"/><path d="M14.5 4a3 3 0 0 1 3 3v1.2a2.8 2.8 0 0 1 0 5.6V15a3 3 0 0 1-3 3"/><path d="M9.5 10.5h5"/><path d="M9.5 15.5h5"/><path d="M12 4v14"/></svg>',
	IconBriefcase:
		'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/></svg>',
	IconGlobe:
		'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a13 13 0 0 1 0 18"/><path d="M12 3a13 13 0 0 0 0 18"/></svg>',
	IconTarget:
		'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/></svg>',
	IconGitBranch:
		'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="5" r="2"/><circle cx="18" cy="19" r="2"/><circle cx="6" cy="19" r="2"/><path d="M6 7v8a4 4 0 0 0 4 4h6"/><path d="M18 17v-2a4 4 0 0 0-4-4H6"/></svg>',
	IconChartBar:
		'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V9"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/></svg>',
	IconDatabase:
		'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7"/></svg>',
	IconRobot:
		'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h10a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-7a3 3 0 0 1 3-3Z"/><path d="M12 7V3"/><path d="M8 13h.01"/><path d="M16 13h.01"/><path d="M9 17h6"/></svg>',
	IconSchema:
		'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="9" y="14" width="6" height="6" rx="1"/><path d="M10 7h4"/><path d="M12 10v4"/></svg>',
	IconSettings:
		'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.8 1.8 0 0 0 15 19.4a1.8 1.8 0 0 0-1 .6V20a2 2 0 1 1-4 0v-.1a1.8 1.8 0 0 0-1-.6 1.8 1.8 0 0 0-1.98.36l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.8 1.8 0 0 0 4.6 15a1.8 1.8 0 0 0-.6-1H4a2 2 0 1 1 0-4h.1a1.8 1.8 0 0 0 .6-1 1.8 1.8 0 0 0-.36-1.98l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.8 1.8 0 0 0 9 4.6a1.8 1.8 0 0 0 1-.6V4a2 2 0 1 1 4 0v.1a1.8 1.8 0 0 0 1 .6 1.8 1.8 0 0 0 1.98-.36l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.8 1.8 0 0 0 19.4 9c.2.36.4.65.6 1H20a2 2 0 1 1 0 4h-.1a1.8 1.8 0 0 0-.5 1Z"/></svg>',
	IconFileText:
		'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h6"/></svg>',
	IconMessages:
		'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 16H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2"/><path d="M8 20l4-4h8a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2z"/></svg>',
	IconTrendingUp:
		'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m3 17 6-6 4 4 7-7"/><path d="M14 8h6v6"/></svg>',
};
const MENU_CHEVRON_SVG =
	'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>';

function resolveActionId(action: unknown): string | null {
	if (typeof action === "string" && action.length > 0) return action;
	if (action && typeof action === "object" && "id" in action) {
		const id = (action as { id?: unknown }).id;
		if (typeof id === "string" && id.length > 0) return id;
	}
	return null;
}

function resolveLabel(item: RuntimeMenuItem, index: number): string {
	const raw = item.title || item.key || `Item ${index + 1}`;
	if (raw.startsWith("menu.")) {
		const i18n = getI18nInstance();
		if (i18n.isInitialized) {
			if (item.__microfrontendId) {
				const scoped = i18n.t(`${item.__microfrontendId}.${raw}`, {
					ns: "menu-groups",
				});
				if (scoped && scoped !== `${item.__microfrontendId}.${raw}`)
					return scoped;
			}
			const translated = i18n.t(raw, { ns: "menu-groups" });
			if (translated && translated !== raw) return translated;
		}
		const short = raw.slice(5).split(".").pop() || raw.slice(5);
		const normalized = short.replace(/[_-]+/g, " ").trim();
		return normalized.charAt(0).toUpperCase() + normalized.slice(1);
	}
	return raw;
}

function bindMenuToMicrofrontend(
	item: RuntimeMenuItem,
	microfrontendId: string,
): RuntimeMenuItem {
	return {
		...item,
		__microfrontendId: microfrontendId,
		items: Array.isArray(item.items)
			? item.items.map((child) =>
					bindMenuToMicrofrontend(child, microfrontendId),
				)
			: item.items,
	};
}

// Adds a microfrontend's menu into a group exactly once. Both the eager
// `ensureAssistantsLoaded` path and the generic `ensureGroupLoaded` loader can
// touch the same module; dedup by the bound `__microfrontendId` so a module
// (e.g. mf-assistants under "ai") never produces a duplicate menu entry.
function addGroupMenuOnce(
	groupId: string,
	moduleName: string,
	runtime: any,
	menu: RuntimeMenuItem,
): boolean {
	if (!loadedGroupMenus[groupId]) loadedGroupMenus[groupId] = [];
	const namespace = resolveMicrofrontendNamespace(moduleName, runtime);
	const already = loadedGroupMenus[groupId].some(
		(item) => item && (item as RuntimeMenuItem).__microfrontendId === namespace,
	);
	if (already) return false;
	loadedGroupMenus[groupId].push(bindMenuToMicrofrontend(menu, namespace));
	return true;
}

function resolveMicrofrontendNamespace(
	moduleName: string,
	runtime: any,
): string {
	const id = runtime?.ID ?? runtime?.default?.name;
	if (typeof id === "string" && id.length > 0) {
		if (id.startsWith("mf-")) return id;
		if (id.endsWith("-mf")) return `mf-${id.slice(0, -3)}`;
		return id;
	}
	return moduleName;
}

function resolveIconName(item: RuntimeMenuItem, depth: number): string | null {
	if (typeof item.iconName === "string" && item.iconName.length > 0) {
		return item.iconName;
	}
	if (typeof item.icon === "string" && item.icon.length > 0) {
		return item.icon;
	}
	const actionId = resolveActionId(item.action);
	const values = [item.key, item.title, actionId]
		.filter((value): value is string => typeof value === "string")
		.map((value) => value.toLowerCase());
	if (values.some((value) => value.includes("upgrade"))) {
		return "IconTrendingUp";
	}
	if (depth === 0 && item.key) {
		const group = GROUPS.find((g) => g.id === item.key);
		if (group?.iconName) return group.iconName;
	}
	return null;
}

function setMenuIcon(target: HTMLElement, iconName: string | null): void {
	target.className = "ssr-menu-icon";
	if (!iconName) {
		target.classList.add("ssr-menu-icon-empty");
		target.innerHTML = "";
		return;
	}
	const svg = MENU_ICON_SVG[iconName];
	if (!svg) {
		target.classList.add("ssr-menu-icon-empty");
		target.innerHTML = "";
		return;
	}
	target.innerHTML = svg;
}

function setMenuChevron(target: HTMLElement, withArrow: boolean): void {
	target.className = withArrow
		? "ssr-menu-chevron"
		: "ssr-menu-chevron ssr-menu-chevron-empty";
	target.innerHTML = MENU_CHEVRON_SVG;
}

function createGroupButton(groupId: string, title: string): HTMLButtonElement {
	const button = document.createElement("button");
	button.type = "button";
	button.className = "ssr-panel-link ssr-menu-action";
	button.dataset.groupId = groupId;

	const chevron = document.createElement("span");
	setMenuChevron(chevron, true);
	const icon = document.createElement("span");
	const groupIconName = GROUPS.find((g) => g.id === groupId)?.iconName ?? null;
	setMenuIcon(icon, groupIconName);
	const text = document.createElement("span");
	text.className = "ssr-menu-label";
	text.textContent = title;
	button.append(chevron, icon, text);
	return button;
}

function renderFallbackGroups(host: HTMLElement): void {
	host.innerHTML = "";
	if (!isAuthenticated()) return;
	const availableGroups = GROUPS.filter(
		(group) => !visibleGroupIds || visibleGroupIds.has(group.id),
	);
	for (const group of availableGroups) {
		host.appendChild(createGroupButton(group.id, group.title));
	}
}

function readInitialData(): InitialDataShape {
	const el = document.getElementById("__INITIAL_DATA__");
	if (!el?.textContent) return {};
	try {
		return JSON.parse(el.textContent) as InitialDataShape;
	} catch {
		return {};
	}
}

type LandingBlockAnchor = {
	id: string;
	type: string;
};

function readLandingBlockAnchors(): LandingBlockAnchor[] {
	const landing = readInitialData().landing;
	if (!landing || typeof landing !== "object") return [];

	for (const payload of Object.values(landing)) {
		if (!payload || typeof payload !== "object") continue;
		const blocks = (payload as { blocks?: unknown }).blocks;
		if (!Array.isArray(blocks)) continue;

		return blocks.flatMap((block): LandingBlockAnchor[] => {
			if (!block || typeof block !== "object") return [];
			const record = block as Record<string, unknown>;
			const id = typeof record.id === "string" ? record.id.trim() : "";
			const type = typeof record.type === "string" ? record.type.trim() : "";
			return id && type ? [{ id, type }] : [];
		});
	}

	return [];
}

function findLandingBlockContainer(): HTMLElement | null {
	return document.querySelector<HTMLElement>(
		"#root main .flex.w-full.flex-col.items-center",
	);
}

function createLandingAnchor(id: string): HTMLElement {
	const anchor = document.createElement("span");
	anchor.id = id;
	anchor.style.display = "block";
	anchor.style.position = "relative";
	anchor.style.top = "-176px";
	anchor.style.height = "0";
	anchor.style.visibility = "hidden";
	anchor.style.pointerEvents = "none";
	return anchor;
}

function applyLandingBlockAnchors(): boolean {
	const anchors = readLandingBlockAnchors();
	const container = findLandingBlockContainer();
	if (anchors.length === 0 || !container) return false;

	const children = Array.from(container.children).filter(
		(child): child is HTMLElement => child instanceof HTMLElement,
	);

	anchors.forEach((anchor, index) => {
		if (document.getElementById(anchor.id)) return;

		const target = children[index];
		if (!target) return;

		if (!target.id) {
			target.id = anchor.id;
			target.style.scrollMarginTop = "176px";
			return;
		}

		target.before(createLandingAnchor(anchor.id));
	});

	return anchors.every((anchor) => Boolean(document.getElementById(anchor.id)));
}

function installLandingBlockAnchors(): void {
	if (applyLandingBlockAnchors()) return;

	const root = document.getElementById("root");
	if (!root) return;

	const observer = new MutationObserver(() => {
		if (applyLandingBlockAnchors()) observer.disconnect();
	});
	observer.observe(root, { childList: true, subtree: true });

	window.setTimeout(() => {
		applyLandingBlockAnchors();
	}, 1000);
}

function initMicrofrontendEnv(): void {
	const initial = readInitialData();
	const current = ((globalThis as any).__MF_ENV__ ?? {}) as Record<
		string,
		unknown
	>;
	const next =
		initial.mfEnv && typeof initial.mfEnv === "object" ? initial.mfEnv : {};
	(globalThis as any).__MF_ENV__ = { ...current, ...next };
}

function normalizeMfName(name: string): string {
	const trimmed = name.trim();
	if (!trimmed) return "";
	return trimmed.startsWith("mf-") ? trimmed : `mf-${trimmed}`;
}

function discoverMicrofrontendsFromRuntime(): string[] {
	const initial = readInitialData();
	const list = Array.isArray(initial.microfrontends)
		? initial.microfrontends
		: [];
	const fromInitial = list
		.filter(
			(name): name is string => typeof name === "string" && name.length > 0,
		)
		.map((name) => normalizeMfName(name))
		.filter((name) => name.length > 0);

	const script = document.querySelector('script[type="importmap"]');
	let fromImportMap: string[] = [];
	if (script?.textContent) {
		try {
			const parsed = JSON.parse(script.textContent) as {
				imports?: Record<string, string>;
			};
			fromImportMap = Object.keys(parsed.imports ?? {}).filter((key) =>
				key.startsWith("mf-"),
			);
		} catch {
			fromImportMap = [];
		}
	}

	return [...new Set([...fromInitial, ...fromImportMap])];
}

async function fetchAllowedMicrofrontends(): Promise<string[] | null> {
	if (!isAuthenticated()) return [];

	const token = authToken.get();
	const payload = authToken.payload();
	if (!token || !payload?.sub) return null;

	const cacheKey = `${payload.sub}:${token}`;
	if (
		allowedMicrofrontendsCacheKey === cacheKey &&
		allowedMicrofrontendsCache
	) {
		return allowedMicrofrontendsCache;
	}
	if (
		allowedMicrofrontendsCacheKey === cacheKey &&
		allowedMicrofrontendsPromise
	) {
		return allowedMicrofrontendsPromise;
	}

	const promise = (async () => {
		try {
			const response = await fetch(MODULES_LIST_FOR_USER_PATH, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					authorization: `Bearer ${token}`,
				},
				credentials: "same-origin",
				body: JSON.stringify({ userId: payload.sub }),
			});

			if (!response.ok) return null;

			const data = await response.json();
			const names = Array.isArray(data)
				? data
						.map((item) => {
							if (!item || typeof item !== "object") return "";
							const rawName = (item as { name?: unknown }).name;
							return typeof rawName === "string"
								? normalizeMfName(rawName)
								: "";
						})
						.filter((name): name is string => name.length > 0)
				: [];

			return [...new Set(names)];
		} catch {
			return null;
		}
	})();

	allowedMicrofrontendsCacheKey = cacheKey;
	allowedMicrofrontendsPromise = promise;
	const resolved = await promise;
	allowedMicrofrontendsCache = resolved;
	allowedMicrofrontendsPromise = null;
	return resolved;
}

async function discoverMicrofrontends(): Promise<string[]> {
	const discovered = discoverMicrofrontendsFromRuntime();

	if (!isAuthenticated()) {
		visibleGroupIds = null;
		return discovered;
	}

	const allowed = await fetchAllowedMicrofrontends();
	if (allowed === null) {
		visibleGroupIds = new Set<string>();
		return [];
	}

	const allowedSet = new Set(allowed);
	const filtered = discovered.filter((name) => allowedSet.has(name));
	visibleGroupIds = new Set(filtered.map((name) => getMfGroup(name)));
	return filtered;
}

const MF_GROUPS: Record<string, string> = {
	"mf-assistants": "ai",
	"mf-agents": "ai",
	"mf-logs": "analytics",
	"mf-telemetry": "analytics",
	"mf-usage": "analytics",
	"mf-dasboards": "analytics",
	"mf-dag": "workflows",
	"mf-requests": "sales",
	"mf-orders": "sales",
	"mf-sheduller": "workflows",
	"mf-webhooks": "workflows",
	"mf-docs": "content",
	"mf-landing": "content",
	"mf-markdown": "content",
	"mf-struct": "content",
	"mf-galery": "content",
	"mf-threads": "content",
	"mf-dumps": "data",
	"mf-calls": "ai",
	"mf-community": "social",
	"mf-charts": "social",
	"mf-marker": "marketing",
	"mf-mailing": "sales",
	"mf-sales": "sales",
	"mf-parameters": "business",
	"mf-geo": "geo",
	"mf-places": "geo",
	"mf-companies": "geo",
};

function getMfGroup(name: string): string {
	return MF_GROUPS[name] ?? "content";
}

function publishLoadedGroupsMenu(): void {
	const order = [
		...GROUPS.map((g) => g.id),
		...Object.keys(loadedGroupMenus).filter(
			(id) => !GROUPS.some((g) => g.id === id),
		),
	];
	const groupedMenu = order
		.filter((id) => (loadedGroupMenus[id]?.length ?? 0) > 0)
		.map((id) => {
			const groupDef = GROUPS.find((g) => g.id === id);
			return {
				key: id,
				title: groupDef?.title ?? id,
				iconName: groupDef?.iconName,
				items: loadedGroupMenus[id],
			};
		});

	if (groupedMenu.length > 0) {
		addMenuRequested({ microfrontendId: "grouped", menu: groupedMenu });
	}
}

async function ensureGroupLoaded(groupId: string): Promise<void> {
	const existing = groupLoadPromises.get(groupId);
	if (existing) return existing;

	const promise = (async () => {
		const names = await discoverMicrofrontends();
		if (names.length === 0) return;
		initMicrofrontendEnv();

		const toLoad = names.filter((name) => getMfGroup(name) === groupId);

		if (!loadedGroupMenus[groupId]) loadedGroupMenus[groupId] = [];

		for (const name of toLoad) {
			try {
				const runtime = await import(/* @vite-ignore */ name);

				if (!loadedModules.has(name) && runtime?.default?.plug) {
					runtime.default.plug(bus);
					loadedModules.add(name);
				}

				let menu = runtime?.MENU;
				if (!menu && typeof runtime?.getMenu === "function") {
					try {
						menu = await runtime.getMenu();
					} catch {
						// ignore getMenu errors per module
					}
				}
				if (menu) {
					addGroupMenuOnce(groupId, name, runtime, menu);
				}
			} catch (error) {
				console.error(`[ssr-menu] failed to load ${name}`, error);
			}
		}

		publishLoadedGroupsMenu();
	})();

	groupLoadPromises.set(groupId, promise);
	return promise;
}

function resetDynamicMenuRuntimeState(): void {
	groupLoadPromises.clear();
	for (const key of Object.keys(loadedGroupMenus)) {
		delete loadedGroupMenus[key];
	}
	loadedModules.clear();
	visibleGroupIds = null;
	allowedMicrofrontendsCacheKey = null;
	allowedMicrofrontendsCache = null;
	allowedMicrofrontendsPromise = null;
	clearAllMenus();
}

function buildTreeNode(
	item: RuntimeMenuItem,
	depth: number,
	index: number,
): HTMLElement {
	const label = resolveLabel(item, index);
	const children = Array.isArray(item.items) ? item.items : [];
	const actionId = resolveActionId(item.action);
	const iconName = resolveIconName(item, depth);
	const href =
		typeof item.href === "string" && item.href.length > 0 ? item.href : null;

	if (children.length > 0) {
		const details = document.createElement("details");
		details.className = "ssr-menu-tree";
		details.open = depth === 0 ? item.key === preferredOpenGroupId : false;
		if (actionId) {
			details.dataset.nodeActionId = actionId;
		}
		if (href) {
			details.dataset.nodeHref = href;
		}

		const summary = document.createElement("summary");
		summary.className = "ssr-panel-link ssr-menu-action";
		summary.style.paddingLeft = `${8 + depth * 16}px`;
		const chevron = document.createElement("span");
		setMenuChevron(chevron, true);
		const icon = document.createElement("span");
		setMenuIcon(icon, iconName);
		const text = document.createElement("span");
		text.className = "ssr-menu-label";
		text.textContent = label;
		summary.append(chevron, icon, text);
		// Parent nodes should expand/collapse on click.
		// Keep action binding only on leaf nodes so nested commands stay reachable.
		details.appendChild(summary);

		const nested = document.createElement("div");
		nested.className = "ssr-menu-nested";
		children.forEach((child, childIndex) => {
			nested.appendChild(buildTreeNode(child, depth + 1, childIndex));
		});
		details.appendChild(nested);
		return details;
	}

	if (href) {
		const a = document.createElement("a");
		a.href = href;
		a.className = "ssr-panel-link ssr-menu-action";
		a.style.paddingLeft = `${8 + depth * 16}px`;
		const chevron = document.createElement("span");
		setMenuChevron(chevron, false);
		const icon = document.createElement("span");
		setMenuIcon(icon, iconName);
		const text = document.createElement("span");
		text.className = "ssr-menu-label";
		text.textContent = label;
		a.append(chevron, icon, text);
		return a;
	}

	const button = document.createElement("button");
	button.type = "button";
	button.className = "ssr-panel-link ssr-menu-action";
	button.style.paddingLeft = `${8 + depth * 16}px`;
	const chevron = document.createElement("span");
	setMenuChevron(chevron, false);
	const icon = document.createElement("span");
	setMenuIcon(icon, iconName);
	const text = document.createElement("span");
	text.className = "ssr-menu-label";
	text.textContent = label;
	button.append(chevron, icon, text);
	if (actionId) {
		button.dataset.actionId = actionId;
	} else {
		button.disabled = true;
		button.style.opacity = "0.7";
	}
	return button;
}

function installDynamicMenu(menuPanel: HTMLElement): void {
	const groupsHost = menuPanel.querySelector<HTMLElement>(
		"[data-ssr-menu-groups]",
	);
	if (!groupsHost) return;

	const render = (items: RuntimeMenuItem[]) => {
		groupsHost.innerHTML = "";
		const normalized = Array.isArray(items) ? items : [];
		bridge.setMenu(normalized as unknown[]);

		if (!isAuthenticated()) {
			return;
		}

		const groupedById = new Map<string, RuntimeMenuItem>();
		for (const item of normalized) {
			if (item.key) groupedById.set(item.key, item);
		}

		const availableGroups = GROUPS.filter(
			(group) => !visibleGroupIds || visibleGroupIds.has(group.id),
		);
		const availableGroupSet = new Set(availableGroups.map((group) => group.id));

		for (const group of availableGroups) {
			const node = groupedById.get(group.id);
			if (node) {
				groupsHost.appendChild(buildTreeNode(node, 0, 0));
			} else {
				groupsHost.appendChild(createGroupButton(group.id, group.title));
			}
		}

		for (const item of normalized) {
			if (!item.key) continue;
			if (visibleGroupIds && !visibleGroupIds.has(item.key)) continue;
			if (availableGroupSet.has(item.key)) continue;
			groupsHost.appendChild(buildTreeNode(item, 0, 0));
		}
	};

	const renderCurrent = () => {
		render(($allMenuItems.getState?.() as RuntimeMenuItem[]) || []);
	};

	const refreshAvailableModulesAndRender = async () => {
		if (isAuthenticated()) {
			await discoverMicrofrontends();
		} else {
			visibleGroupIds = null;
		}
		renderCurrent();
	};

	if (groupsHost.dataset.menuActionsBound !== "1") {
		groupsHost.dataset.menuActionsBound = "1";
		groupsHost.addEventListener("click", (event) => {
			const eventEl = resolveEventElement(event.target);
			if (!eventEl) return;
			const summaryEl = eventEl.closest("summary");
			if (summaryEl) {
				const parentDetails = summaryEl.parentElement as HTMLElement | null;
				const actionId = parentDetails?.dataset.nodeActionId;
				if (actionId) {
					void bridge.selectMenuAction(actionId);
					return;
				}
				const href = parentDetails?.dataset.nodeHref;
				if (href) {
					navigateInternalHref(href);
					return;
				}
			}
			const actionButton = eventEl.closest(
				"[data-action-id]",
			) as HTMLElement | null;
			if (actionButton) {
				const actionId = actionButton.dataset.actionId;
				if (!actionId) return;
				event.preventDefault();
				void bridge.selectMenuAction(actionId);
				return;
			}

			const groupButton = eventEl.closest(
				"[data-group-id]",
			) as HTMLElement | null;
			if (!groupButton) return;
			const groupId = groupButton.dataset.groupId;
			if (!groupId) return;
			event.preventDefault();
			preferredOpenGroupId = groupId;
			renderCurrent();
			void ensureGroupLoaded(groupId).then(() => {
				renderCurrent();
			});
		});
	}

	if (groupsHost.dataset.menuAuthBound !== "1") {
		groupsHost.dataset.menuAuthBound = "1";
		window.addEventListener("auth-token-changed", () => {
			resetDynamicMenuRuntimeState();
			void refreshAvailableModulesAndRender();
		});
	}

	try {
		renderCurrent();
	} catch {
		renderFallbackGroups(groupsHost);
	}

	void refreshAvailableModulesAndRender();

	if (!stopMenuWatch) {
		const watchResult = $allMenuItems.watch((items) => {
			render((items as RuntimeMenuItem[]) || []);
		});
		stopMenuWatch =
			typeof watchResult === "function"
				? watchResult
				: () => (watchResult as { unsubscribe?: () => void }).unsubscribe?.();
	}
}

async function navigateByFragment(
	url: URL,
	mode: "push" | "replace" | "none" = "push",
): Promise<void> {
	const currentRoot = document.getElementById("root");
	if (!currentRoot) return;

	if (pendingNavigation) pendingNavigation.abort();
	const controller = new AbortController();
	pendingNavigation = controller;

	try {
		const response = await fetch(url.toString(), {
			method: "GET",
			headers: {
				Accept: "text/html",
				"X-Fragment-Request": "root",
			},
			signal: controller.signal,
			credentials: "same-origin",
		});

		if (!response.ok) {
			navProgressDone();
			window.location.assign(url.toString());
			return;
		}

		const html = await response.text();
		const encodedTitle = response.headers.get("X-Page-Title-B64")?.trim() || "";
		let nextTitle = "";
		if (encodedTitle.length > 0) {
			try {
				const binary = atob(encodedTitle);
				const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
				nextTitle = new TextDecoder().decode(bytes);
			} catch {
				nextTitle = "";
			}
		}
		const nextRoot = extractRootFromHtml(html);
		if (!nextRoot) {
			navProgressDone();
			window.location.assign(url.toString());
			return;
		}

		currentRoot.replaceWith(nextRoot);
		installHeroRequestController();
		if (nextTitle.length > 0) {
			document.title = nextTitle;
		}
		navProgressDone();

		if (mode === "push") {
			history.pushState({ by: "fragment-nav" }, "", url.toString());
		} else if (mode === "replace") {
			history.replaceState({ by: "fragment-nav" }, "", url.toString());
		}

		if (typeof (globalThis as any).gtag === "function") {
			(globalThis as any).gtag("event", "page_view", {
				page_path: url.pathname + url.search,
			});
		}

		if (url.hash) {
			requestAnimationFrame(() => scrollToHashTarget(url.hash));
		}
	} catch {
		if (!controller.signal.aborted) {
			navProgressDone();
			window.location.assign(url.toString());
		}
	} finally {
		if (pendingNavigation === controller) {
			pendingNavigation = null;
		}
	}
}

function navigateInternalHref(href: string): void {
	const url = new URL(href, window.location.href);
	if (
		url.pathname === window.location.pathname &&
		url.search === window.location.search
	) {
		if (!url.hash) return;

		if (window.location.hash === url.hash) {
			scrollToHashTarget(url.hash);
		} else {
			window.location.hash = url.hash;
		}
		return;
	}

	navProgressStart();
	linkInterceptorDocumentPath = `${url.pathname}${url.search}`;
	void navigateByFragment(url, "push");
}

function installLinkInterceptor(): void {
	if (document.documentElement.dataset.ssrNavBridge === "1") return;
	document.documentElement.dataset.ssrNavBridge = "1";
	linkInterceptorDocumentPath = `${window.location.pathname}${window.location.search}`;

	window.addEventListener("front-core:navigate-fragment", (event) => {
		const href = (event as CustomEvent<{ href?: unknown }>).detail?.href;
		if (typeof href !== "string" || href.length === 0) return;
		event.preventDefault();
		navigateInternalHref(href);
	});

	document.addEventListener("click", (event) => {
		const eventEl = resolveEventElement(event.target);
		if (!eventEl) return;
		const link = eventEl.closest("a[href]") as HTMLAnchorElement | null;
		if (!link) return;
		if (!isInterceptableLink(link, event)) return;

		const url = new URL(link.href, window.location.href);
		if (
			url.pathname === window.location.pathname &&
			url.search === window.location.search
		) {
			event.preventDefault();
			if (!url.hash) return;

			if (window.location.hash === url.hash) {
				scrollToHashTarget(url.hash);
			} else {
				window.location.hash = url.hash;
			}
			return;
		}

		event.preventDefault();
		navigateInternalHref(url.toString());
	});

	window.addEventListener("popstate", () => {
		const url = new URL(window.location.href);
		const nextDocumentPath = `${url.pathname}${url.search}`;
		if (nextDocumentPath === linkInterceptorDocumentPath) {
			if (url.hash) {
				scrollToHashTarget(url.hash);
			}
			return;
		}

		linkInterceptorDocumentPath = nextDocumentPath;
		navProgressStart();
		void navigateByFragment(url, "none");
	});
}

async function openAiChat(
	message?: string,
	options?: { contextName?: string },
): Promise<void> {
	setControlPanelMode("app");
	await ensureControlPanelRuntime();
	await ensureAssistantsLoaded();
	await ensureTemporarySessionForChat();
	chatInitRequested({ contextName: options?.contextName });
	runActionEvent({
		actionId: "chats.show",
		params: { contextName: options?.contextName },
	});
	const text = message?.trim();
	if (text) {
		chatSendRequested(text);
	}
}

type LandingEventPayload = {
	message?: string;
	contextName?: string;
	payload?: unknown;
};
type LandingEventHandler = (payload: LandingEventPayload) => void;

const LANDING_EVENT_HANDLERS: Record<string, LandingEventHandler> = {
	"chat.open": ({ message, contextName }) => {
		void openAiChat(message, { contextName });
	},
	"chat.attach": ({ contextName }) => {
		void openAiChat(undefined, { contextName }).then(() =>
			chatAttachRequested(),
		);
	},
};

function parseLandingPayload(raw: string | undefined): unknown {
	if (!raw) return undefined;
	try {
		return JSON.parse(raw);
	} catch {
		return raw;
	}
}

function readLandingEventPayload(source: HTMLElement): LandingEventPayload {
	const form =
		source instanceof HTMLFormElement ? source : source.closest("form");
	const messageSelector =
		source.dataset.landingMessageInput || form?.dataset.landingMessageInput;
	const messageInput = messageSelector
		? form?.querySelector<HTMLInputElement | HTMLTextAreaElement>(
				messageSelector,
			)
		: form?.querySelector<HTMLInputElement | HTMLTextAreaElement>(
				'[name="message"]',
			);
	const message = source.dataset.landingMessage ?? messageInput?.value;

	return {
		message,
		contextName:
			source.dataset.landingContextName || form?.dataset.landingContextName,
		payload: parseLandingPayload(
			source.dataset.landingPayload || form?.dataset.landingPayload,
		),
	};
}

function dispatchLandingEvent(
	eventName: string,
	payload: LandingEventPayload,
): void {
	const handler = LANDING_EVENT_HANDLERS[eventName];
	if (handler) {
		handler(payload);
		return;
	}

	console.warn(`[landing-event] unknown event "${eventName}"`, payload);
}

function installLandingEventGateway(): void {
	if (landingEventGatewayBound) return;
	landingEventGatewayBound = true;

	document.addEventListener("submit", (event) => {
		const form = event.target instanceof HTMLFormElement ? event.target : null;
		const eventName = form?.dataset.landingEvent;
		if (!form || !eventName) return;

		event.preventDefault();
		dispatchLandingEvent(eventName, readLandingEventPayload(form));
	});

	document.addEventListener("click", (event) => {
		const eventEl = resolveEventElement(event.target);
		const source = eventEl?.closest<HTMLElement>("[data-landing-event]");
		if (!source || source instanceof HTMLFormElement) return;

		event.preventDefault();
		dispatchLandingEvent(
			source.dataset.landingEvent ?? "",
			readLandingEventPayload(source),
		);
	});
}

function installHeroRequestController(): void {
	heroRequestCleanup?.();
	heroRequestCleanup = null;

	const root = document.querySelector<HTMLElement>(".hsl-root");
	const slot = root?.querySelector<HTMLElement>(".hsl-hero-input-slot");
	const input = root?.querySelector<HTMLElement>(".hsl-hero-input");
	const form = root?.querySelector<HTMLFormElement>(".hsl-form");
	const textarea = root?.querySelector<HTMLTextAreaElement>(".hsl-textarea");
	const html = document.documentElement;

	if (!root || !slot || !input) {
		delete html.dataset.heroInputDocked;
		return;
	}

	let frame = 0;
	let docked = input.classList.contains("hsl-hero-input--docked");

	const setDocked = (nextDocked: boolean) => {
		if (docked === nextDocked) return;
		docked = nextDocked;
		input.classList.toggle("hsl-hero-input--docked", nextDocked);
		html.dataset.heroInputDocked = nextDocked ? "1" : "0";
	};

	const measure = () => {
		frame = 0;
		if (getAppliedControlPanelMode() !== "public") {
			setDocked(false);
			return;
		}
		const top = slot.getBoundingClientRect().top;
		setDocked(top <= (docked ? 62 : 52));
	};

	const scheduleMeasure = () => {
		if (frame) return;
		frame = window.requestAnimationFrame(measure);
	};

	const setPrompt = (prompt: string) => {
		if (!textarea) return;
		textarea.value = prompt;
		textarea.dispatchEvent(new Event("input", { bubbles: true }));
		textarea.focus();
		try {
			textarea.setSelectionRange(prompt.length, prompt.length);
		} catch {
			// Some browsers can reject selection updates during focus changes.
		}
	};

	const onDocumentClick = (event: MouseEvent) => {
		const eventEl = resolveEventElement(event.target);
		const chip = eventEl?.closest<HTMLButtonElement>(
			".hsl-chip[data-hero-prompt]",
		);
		if (!chip || !root.contains(chip)) return;

		event.preventDefault();
		setPrompt(chip.dataset.heroPrompt ?? `${chip.textContent?.trim() ?? ""}: `);
	};

	const onTextareaKeyDown = (event: KeyboardEvent) => {
		if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
		event.preventDefault();
		form?.requestSubmit();
	};

	measure();
	window.addEventListener("scroll", scheduleMeasure, { passive: true });
	window.addEventListener("resize", scheduleMeasure);
	const modeUnwatch = $controlPanelMode.watch(scheduleMeasure);
	document.addEventListener("click", onDocumentClick);
	textarea?.addEventListener("keydown", onTextareaKeyDown);

	heroRequestCleanup = () => {
		window.removeEventListener("scroll", scheduleMeasure);
		window.removeEventListener("resize", scheduleMeasure);
		modeUnwatch();
		document.removeEventListener("click", onDocumentClick);
		textarea?.removeEventListener("keydown", onTextareaKeyDown);
		if (frame) window.cancelAnimationFrame(frame);
		input.classList.remove("hsl-hero-input--docked");
		delete html.dataset.heroInputDocked;
	};
}

function normalizeQuickChatPrompt(prompt: QuickChatPrompt): {
	label: string;
	message: string;
	contextName?: string;
	icon?: string;
} | null {
	if (typeof prompt === "string") {
		const text = prompt.trim();
		return text ? { label: text, message: text } : null;
	}
	if (!prompt || typeof prompt !== "object") return null;

	const message = (
		prompt.message ??
		prompt.prompt ??
		prompt.label ??
		""
	).trim();
	const label = (prompt.label ?? prompt.message ?? prompt.prompt ?? "").trim();
	if (!message || !label) return null;

	return {
		label,
		message,
		contextName: prompt.contextName?.trim() || undefined,
		icon: prompt.icon?.trim() || undefined,
	};
}

function installChatDock(): void {
	const shell = document.getElementById(SSR_SHELL_ID);
	const dock = document.getElementById(SSR_CHAT_DOCK_ID);
	const form = document.getElementById(
		SSR_CHAT_FORM_ID,
	) as HTMLFormElement | null;
	const input = document.getElementById(
		SSR_CHAT_INPUT_ID,
	) as HTMLTextAreaElement | null;
	const attach = document.getElementById(
		SSR_CHAT_ATTACH_ID,
	) as HTMLButtonElement | null;
	const quick = document.getElementById(SSR_CHAT_QUICK_ID);
	if (!dock || !form || !input || !quick) return;

	if (!chatDockBound) {
		chatDockBound = true;

		const submitMessage = () => {
			const text = input.value.trim();
			if (!text) return;
			input.value = "";
			void openAiChat(text, { contextName: CHAT_CONTEXT });
		};

		form.addEventListener("submit", (event) => {
			event.preventDefault();
			submitMessage();
		});

		attach?.addEventListener("click", () => {
			if (shell) shell.dataset.chatFocus = "1";
			void openAiChat(undefined, { contextName: CHAT_CONTEXT }).then(() =>
				chatAttachRequested(),
			);
		});

		input.addEventListener("keydown", (event) => {
			if (event.key === "Enter" && !event.shiftKey) {
				event.preventDefault();
				submitMessage();
			}
		});
		input.addEventListener("focus", () => {
			if (shell) shell.dataset.chatFocus = "1";
			void openAiChat(undefined, { contextName: CHAT_CONTEXT });
		});

		dock.addEventListener("focusout", () => {
			window.setTimeout(() => {
				if (dock.contains(document.activeElement)) return;
				if (shell) shell.dataset.chatFocus = "0";
			}, 0);
		});

		const renderPrompts = (prompts: readonly QuickChatPrompt[]) => {
			quick.innerHTML = "";
			prompts.forEach((prompt) => {
				const item = normalizeQuickChatPrompt(prompt);
				if (!item) return;

				const button = document.createElement("button");
				button.type = "button";
				button.className = "ssr-chat-quick-btn";
				const icon = item.icon ? QUICK_CHAT_ICON[item.icon] : null;
				if (icon) {
					const iconNode = document.createElement("span");
					iconNode.className = "ssr-chat-quick-icon";
					iconNode.setAttribute("aria-hidden", "true");
					iconNode.innerHTML = icon;
					button.appendChild(iconNode);
				}
				const labelNode = document.createElement("span");
				labelNode.textContent = item.label;
				button.appendChild(labelNode);
				button.addEventListener("click", () => {
					void openAiChat(item.message, { contextName: item.contextName });
				});
				quick.appendChild(button);
			});
		};

		renderPrompts(QUICK_CHAT_PROMPTS);

		const locale = resolveRuntimeLocale(window.location.pathname);
		try {
			structClient
				.readJson(`${locale}/magic/chat-prompts.json`)
				.then((data) => {
					const prompts = Array.isArray(data?.prompts) ? data.prompts : null;
					if (prompts) renderPrompts(prompts);
				})
				.catch(() => {});
		} catch {
			// no auth token in browser — skip
		}
	}

	let lastDockHeight = -1;
	const syncDockGeometry = () => {
		const dockHeight = Math.ceil(dock.getBoundingClientRect().height);
		if (dockHeight === lastDockHeight) return;
		lastDockHeight = dockHeight;
		document.documentElement.style.setProperty(
			"--ssr-dock-height",
			`${dockHeight}px`,
		);
		dock.dataset.overlap = "0";
	};

	syncDockGeometry();
	if (!chatDockGeometryBound) {
		chatDockGeometryBound = true;
		chatDockResizeObserver = new ResizeObserver(syncDockGeometry);
		chatDockResizeObserver.observe(dock);
		const observer = new MutationObserver(syncDockGeometry);
		observer.observe(dock, {
			childList: true,
			subtree: true,
			attributes: true,
		});
	}
}

function hasRightRailDeepLink(): boolean {
	const search = new URLSearchParams(window.location.search);
	return RIGHT_RAIL_QUERY_KEYS.some((key) => search.has(key));
}

function stripLocalePrefix(pathname: string): string {
	return stripRuntimeLocalePrefix(pathname);
}

function isSsrPublicRoute(pathname: string): boolean {
	const localeRouting = readInitialLocaleRouting();
	if (localeRouting.mode === "single") {
		return (
			pathname === "/" || pathname === "/cnc" || pathname.startsWith("/docs/")
		);
	}
	const locale = extractLocaleFromPath(pathname);
	if (!locale) return false;

	const rest = pathname.slice(locale.length + 1) || "/";
	return rest === "/" || rest === "/cnc" || rest.startsWith("/docs/");
}

function buildLocaleTargetUrl(locale: SupportedLocale): URL {
	const target = new URL(window.location.href);
	target.pathname = buildLocalePath(locale, stripLocalePrefix(target.pathname));
	return target;
}

function setLangMenuOpen(
	root: HTMLElement,
	control: HTMLButtonElement,
	open: boolean,
): void {
	root.dataset.open = open ? "1" : "0";
	control.setAttribute("aria-expanded", open ? "true" : "false");
}

function syncLangMenuSelection(): void {
	const root = document.querySelector<HTMLElement>("[data-ssr-lang-root]");
	const control = getControl("lang");
	const current = document.querySelector<HTMLElement>(
		"[data-ssr-lang-current]",
	);
	if (!root || !control) return;

	const localeController = LocaleController.getInstance();
	const activeLocale = localeController.hydrateFromPath(
		window.location.pathname,
	);
	root.dataset.activeLocale = activeLocale;

	const selectedLabel =
		AVAILABLE_LANGS.find((item) => item.code === activeLocale)?.name ??
		activeLocale.toUpperCase();
	control.setAttribute("aria-label", `Language: ${selectedLabel}`);
	if (current) {
		current.textContent = activeLocale.toUpperCase();
	}

	const options = document.querySelectorAll<HTMLButtonElement>(
		"[data-ssr-lang-option]",
	);
	options.forEach((option) => {
		const code = option.dataset.ssrLangOption;
		const isSelected = code === activeLocale;
		option.setAttribute("aria-pressed", isSelected ? "true" : "false");
	});
}

async function applyLocaleChange(nextLocaleRaw: string): Promise<void> {
	if (readInitialLocaleRouting().mode === "single") return;
	if (!isSupportedLocale(nextLocaleRaw)) return;

	const nextLocale = nextLocaleRaw;
	const localeController = LocaleController.getInstance();
	const targetUrl = buildLocaleTargetUrl(nextLocale);

	// Single source of truth: sync both translation layers ($activeLocale for
	// the microfrontend translations and i18next for the shell/control panel)
	// regardless of the route type, so they can never drift apart.
	await localeController.setLocale(nextLocale);

	if (isSsrPublicRoute(window.location.pathname)) {
		// The public landing is SSR-only (not hydrated for guests), so re-fetch
		// the localized center fragment. The control panel is a separate React
		// root and re-localizes itself reactively via i18next.
		await navigateByFragment(targetUrl, "replace");
		syncLangMenuSelection();
		return;
	}

	const nextHref = `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
	window.history.replaceState(window.history.state, "", nextHref);
	window.dispatchEvent(new PopStateEvent("popstate"));
	syncLangMenuSelection();
}

function installLangControl(): void {
	if (readInitialLocaleRouting().mode === "single") return;
	const root = document.querySelector<HTMLElement>("[data-ssr-lang-root]");
	const control = getControl("lang");
	const menu = document.querySelector<HTMLElement>("[data-ssr-lang-menu]");
	if (!root || !control || !menu) return;

	const closeMenu = () => setLangMenuOpen(root, control, false);

	if (root.dataset.langBound === "1") {
		syncLangMenuSelection();
		return;
	}

	root.dataset.langBound = "1";
	setLangMenuOpen(root, control, false);
	syncLangMenuSelection();

	control.addEventListener("click", (event) => {
		event.preventDefault();
		event.stopPropagation();
		const open = root.dataset.open === "1";
		setLangMenuOpen(root, control, !open);
	});

	menu.addEventListener("click", (event) => {
		const eventEl = resolveEventElement(event.target);
		if (!eventEl) return;
		const option = eventEl.closest(
			"[data-ssr-lang-option]",
		) as HTMLButtonElement | null;
		if (!option) return;

		event.preventDefault();
		const nextLocale = option.dataset.ssrLangOption;
		closeMenu();
		if (!nextLocale) return;
		void applyLocaleChange(nextLocale);
	});

	document.addEventListener("click", (event) => {
		const eventEl = resolveEventElement(event.target);
		if (!eventEl || !root.contains(eventEl)) {
			closeMenu();
		}
	});

	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape") {
			closeMenu();
		}
	});

	window.addEventListener("popstate", syncLangMenuSelection);
}

export function mountSsrMenuShell(): void {
	if (typeof document === "undefined") return;

	ensureControlPanelModeBinding();
	ensureStyles();
	ensureFrontCoreStyles();
	void ensureControlPanelRuntime().then(() => {
		installDynamicMenuIfReady();
	});

	installLandingEventGateway();
	installLandingBlockAnchors();
	installHeroRequestController();
	installLinkInterceptor();

	window.addEventListener("auth-token-changed", () => {
		setControlPanelMode(resolveAuthChangedControlPanelMode());
	});

	// Keep first paint stable: bootstrap panel runtime lazily for deep links.
	if (hasRightRailDeepLink()) {
		void ensureControlPanelRuntime().then(() => setControlPanelMode("app"));
	}
}
