import { createEvent, createStore, sample } from "effector";
import type { ReactNode } from "react";

// ── Mode ──────────────────────────────────────────────────────────────────────

export type ControlPanelMode = "public" | "app";

export const controlPanelOpenChanged = createEvent<boolean>();
export const controlPanelModeChanged = createEvent<ControlPanelMode>();
export const controlPanelOpened = createEvent();
export const controlPanelClosed = createEvent();

export const $isControlPanelOpen = createStore(false)
	.on(controlPanelOpenChanged, (_, isOpen) => isOpen)
	.on(controlPanelModeChanged, (_, mode) => mode === "app")
	.on(controlPanelOpened, () => true)
	.on(controlPanelClosed, () => false);

export const $controlPanelMode = $isControlPanelOpen.map<ControlPanelMode>(
	(isOpen) => (isOpen ? "app" : "public"),
);

export function readControlPanelMode(): ControlPanelMode {
	return $controlPanelMode.getState();
}

// ── Theme ─────────────────────────────────────────────────────────────────────

export type Theme = "light" | "dark";

export const themeToggled = createEvent();
export const themeSet = createEvent<Theme>();

function readInitialTheme(): Theme {
	if (typeof document === "undefined") return "dark";
	if (document.documentElement.classList.contains("dark")) return "dark";
	try {
		const stored = localStorage.getItem("theme");
		if (stored === "light" || stored === "dark") return stored;
	} catch {}
	if (document.documentElement.style.colorScheme === "dark") return "dark";
	if (document.documentElement.style.colorScheme === "light") return "light";
	return "light";
}

export const $theme = createStore<Theme>(readInitialTheme())
	.on(themeToggled, (current) => (current === "dark" ? "light" : "dark"))
	.on(themeSet, (_, theme) => theme);

if (typeof document !== "undefined") {
	$theme.watch((theme) => {
		document.documentElement.classList.toggle("dark", theme === "dark");
		document.documentElement.style.colorScheme = theme;
		try { localStorage.setItem("theme", theme); } catch {}
	});
}

// ── Language ──────────────────────────────────────────────────────────────────

export interface LangOption {
	code: string;
	label: string;
}

export const langChanged = createEvent<string>();
export const languagesSet = createEvent<LangOption[]>();

export const $lang = createStore<string>("en").on(langChanged, (_, code) => code);
export const $languages = createStore<LangOption[]>([]).on(languagesSet, (_, v) => v);

// ── Auth ──────────────────────────────────────────────────────────────────────

export const loginRequested = createEvent();
export const logoutRequested = createEvent();
export const authStateChanged = createEvent<boolean>();
export const loginEnabledSet = createEvent<boolean>();

export const $isAuthenticated = createStore(false).on(authStateChanged, (_, v) => v);
export const $loginEnabled = createStore(true).on(loginEnabledSet, (_, v) => v);

// ── Branding ──────────────────────────────────────────────────────────────────

export interface Branding {
	logoLight?: string;
	logoDark?: string;
	phone?: string;
	statusText?: string;
}

export const brandingSet = createEvent<Branding>();
export const $branding = createStore<Branding>({}).on(brandingSet, (_, v) => v);

// ── Shared panel actions (top quick-actions + rail quick-actions) ─────────────

export interface PanelAction {
	id: string;
	icon: ReactNode;
	label: string;
	prompt: string;
}

export const panelActionsSet = createEvent<PanelAction[]>();
export const panelActionTriggered = createEvent<string>();

export const $panelActions = createStore<PanelAction[]>([]).on(panelActionsSet, (_, v) => v);

// ── Menu links (public-mode top-bar) ──────────────────────────────────────────

export interface MenuLink {
	label: string;
	href: string;
}

export const menuLinksSet = createEvent<MenuLink[]>();
export const $menuLinks = createStore<MenuLink[]>([]).on(menuLinksSet, (_, v) => v);

// ── Open screens (app-mode rail tabs) ─────────────────────────────────────────

export interface RailScreen {
	id: string;
	label: string;
	detail?: string;
	icon: ReactNode;
}

export const screensSet = createEvent<RailScreen[]>();
export const screenActivated = createEvent<string>();
export const screenClosed = createEvent<string>();

export const $screens = createStore<RailScreen[]>([])
	.on(screensSet, (_, v) => v)
	.on(screenClosed, (s, id) => s.filter((x) => x.id !== id));

export const $activeScreenId = createStore<string>("")
	.on(screenActivated, (_, id) => id)
	.on(screensSet, (_, screens) => screens[0]?.id ?? "");

// ── Tabs (icon strip below the rail header) ──────────────────────────────────

export interface PanelTab {
	id: string;
	icon: ReactNode;
	label: string;
}

/** Built-in tab id for the default chat view. */
export const CHAT_TAB_ID = "chat";
/** Built-in tab id for the fallback app menu. */
export const MENU_TAB_ID = "menu";

export const tabsSet = createEvent<PanelTab[]>();
export const tabActivated = createEvent<string>();

export const $tabs = createStore<PanelTab[]>([]).on(tabsSet, (_, v) => v);
export const $activeTabId = createStore<string>(CHAT_TAB_ID).on(tabActivated, (_, id) => id);

// ── Composer (shared between top-bar input and rail composer) ─────────────────

export const composerValueChanged = createEvent<string>();
export const composerSubmitted = createEvent();
export const composerCleared = createEvent();

/**
 * High-level composer events for opening chat / attaching files.
 *
 * IMPORTANT: do NOT use `chatSendRequested` directly from the composer —
 * `openAiChat` (host) re-fires `chatSendRequested` to deliver the message to
 * the chat MF, which would create an infinite loop if the runtime forwards
 * `chatSendRequested` back into `onOpenChat`.
 */
export const chatOpenRequested = createEvent<string | undefined>();
export const composerAttachRequested = createEvent();

export const $composerValue = createStore<string>("")
	.on(composerValueChanged, (_, v) => v)
	.reset(composerCleared);

// Triggering a panel action loads its prompt into the composer
sample({
	clock: panelActionTriggered,
	target: composerValueChanged,
});

// ── Collapse / mode switch helpers ────────────────────────────────────────────

export const collapseRequested = createEvent();
sample({ clock: collapseRequested, target: controlPanelClosed });

// Clicking the login button opens the auth tab (must be present in $tabs to be visible).
sample({
	clock: loginRequested,
	fn: () => "auth",
	target: tabActivated,
});
