import {
	Activity,
	BadgeCheck,
	CalendarClock,
	ClipboardCheck,
	PackageCheck,
	Ruler,
	Upload,
	Wrench,
} from "lucide-react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { useUnit } from "effector-react";
import { ControlPanel } from "../components/control-panel/ControlPanel";
import { SlotProvider } from "../slots/SlotProvider";
import { $slotContents } from "../slots/slots";
import type { ReactNode } from "react";
import {
	$controlPanelMode,
	authStateChanged,
	brandingSet,
	chatOpenRequested,
	composerAttachRequested,
	controlPanelClosed,
	controlPanelModeChanged,
	controlPanelOpened,
	langChanged,
	languagesSet,
	loginEnabledSet,
	loginRequested,
	logoutRequested,
	menuLinksSet,
	panelActionsSet,
	screensSet,
	tabsSet,
	themeSet,
	type ControlPanelMode,
	type LangOption,
	type MenuLink,
	type PanelAction,
	type PanelTab,
	type RailScreen,
} from "./control-panel-model";

export interface ControlPanelRuntimeOptions {
	logoLight?: string;
	logoDark?: string;
	phone?: string;
	statusText?: string;
	chatPlaceholder?: string;
	menuLinks?: MenuLink[];
	loginEnabled: boolean;
	languages: LangOption[];
	currentLanguage: string;
	isDark: boolean;
	isAuthenticated: () => boolean;
	onAppModeRendered?: () => void;
	onOpenChat: (message?: string) => void;
	onAttach: () => void;
	onLogin: () => void;
	onLogout: () => void;
	onLanguage: (code: string) => void;
	/** Optional: extra side-effect notifications. Model already updates DOM/localStorage. */
	onThemeToggle?: () => void;
	/** Optional: override default top-bar/rail actions. */
	actions?: PanelAction[];
	/** Optional: override default rail screens. */
	screens?: RailScreen[];
	/** Optional: user-defined panel tabs. Chat tab is implicit. */
	tabs?: PanelTab[];
	/** Optional: content for non-chat tabs keyed by tab id. */
	tabContents?: Record<string, ReactNode>;
}

export interface ControlPanelRuntimeHandle {
	setMode: (mode: ControlPanelMode) => void;
	unmount: () => void;
}

const defaultActions: PanelAction[] = [
	{ id: "check", icon: <BadgeCheck size={16} />, label: "Check drawing", prompt: "Check this drawing: " },
	{ id: "upload", icon: <Upload size={16} />, label: "Upload file", prompt: "I want to upload a file for review." },
	{ id: "deadline", icon: <CalendarClock size={16} />, label: "Estimate deadline", prompt: "Estimate deadline: " },
	{ id: "quote", icon: <ClipboardCheck size={16} />, label: "Request quote", prompt: "Prepare a quote: " },
	{ id: "material", icon: <PackageCheck size={16} />, label: "Choose material", prompt: "Help me choose material: " },
	{ id: "tolerances", icon: <Ruler size={16} />, label: "Check tolerances", prompt: "Check tolerances: " },
];

const defaultScreens: RailScreen[] = [
	{ id: "feed", label: "Feed", icon: <Activity size={18} /> },
	{ id: "orders", label: "Orders", icon: <PackageCheck size={18} /> },
	{ id: "request", label: "Request", detail: "intake", icon: <Wrench size={18} /> },
];

function ChatSlot() {
	const contents = useUnit($slotContents);
	// mf-assistants presents into "sidebar:right". We render the slot inline here
	// instead of using the DOM-id + portal mechanism — that would either lose
	// content (when SlotProvider isn't the owner) or duplicate it (causing React
	// removeChild errors when the same element is rendered both via portal and
	// inline).
	const chat = contents["sidebar:right"];
	return (
		<div className="cp-slots cp-chat-slot">
			<style>{slotsCss}</style>
			{chat ?? (
				<div className="ssr-right-rail-empty">
					<h3>AI Assistant</h3>
					<p>Loading...</p>
				</div>
			)}
		</div>
	);
}

function menuSlot() {
	return (
		<nav id="ssr-left-panel" className="crp-menu-slot" aria-label="Menu">
			<div className="ssr-panel-groups" data-ssr-menu-groups />
		</nav>
	);
}

export function mountControlPanelRuntime(
	host: HTMLElement,
	options: ControlPanelRuntimeOptions,
): ControlPanelRuntimeHandle {
	// ── 1. Initialize stores from options ────────────────────────────────────
	themeSet(options.isDark ? "dark" : "light");
	langChanged(options.currentLanguage);
	languagesSet(options.languages);
	loginEnabledSet(options.loginEnabled);
	authStateChanged(options.isAuthenticated());
	brandingSet({
		logoLight: options.logoLight,
		logoDark: options.logoDark,
		phone: options.phone,
		statusText: options.statusText,
	});
	menuLinksSet(options.menuLinks ?? []);
	panelActionsSet(options.actions ?? defaultActions);
	screensSet(options.screens ?? defaultScreens);
	tabsSet(options.tabs ?? []);

	// ── 2. Wire model events → host callbacks ────────────────────────────────
	// NOTE: do NOT watch the low-level chatSendRequested/chatAttachRequested events
	// here — host's onOpenChat() re-fires chatSendRequested to deliver the message
	// to the chat MF, which would create an infinite loop. The composer fires the
	// dedicated chatOpenRequested / composerAttachRequested events instead.
	const subs = [
		langChanged.watch((code) => { void options.onLanguage(code); }),
		loginRequested.watch(() => { void options.onLogin(); }),
		logoutRequested.watch(() => { void options.onLogout(); }),
		chatOpenRequested.watch((message) => { void options.onOpenChat(message); }),
		composerAttachRequested.watch(() => { void options.onAttach(); }),
	];

	// ── 3. Render ControlPanel with mode-driven swap ─────────────────────────
	let root: Root | null = createRoot(host);
	const renderMode = (mode: ControlPanelMode) => {
		host.dataset.mode = mode;
		if (!root) return;
		flushSync(() => {
			root?.render(
				<div className={options.isDark ? "cp-runtime dark" : "cp-runtime"} data-mode={mode}>
					<style>{runtimeCss}</style>
					<ControlPanel
						chatSlot={<ChatSlot />}
						menuSlot={menuSlot()}
						composerPlaceholder={options.chatPlaceholder}
						tabContents={options.tabContents}
					/>
					{/* SlotProvider must be rendered unconditionally so portals into
					    #slot-panel-tab keep working across tab switches. */}
					<SlotProvider />
				</div>,
			);
		});
		if (mode === "app") options.onAppModeRendered?.();
	};
	const unwatch = $controlPanelMode.watch(renderMode);

	return {
		setMode: (mode) => {
			if (mode === "app") controlPanelOpened();
			else controlPanelClosed();
		},
		unmount: () => {
			unwatch();
			subs.forEach((u) => u());
			root?.unmount();
			root = null;
		},
	};
}

export {
	controlPanelClosed,
	controlPanelModeChanged,
	controlPanelOpened,
	type ControlPanelMode,
};

const runtimeCss = `
.cp-runtime { width: 100%; height: 100%; }
.cp-runtime[data-mode="public"] { height: auto; }
.cp-runtime[data-mode="app"] { height: 100vh; }

#ssr-left-panel {
  max-height: 220px;
  border-bottom: 1px solid color-mix(in oklch, var(--ui-border) 74%, transparent);
}
`;

const slotsCss = `
.cp-slots { min-height: 0; height: 100%; display: flex; flex-direction: column; }
.cp-tab-slot, .cp-chat-slot { min-height: 0; min-width: 0; }
.cp-tab-slot:empty { display: none; }
.cp-chat-slot { flex: 1 1 auto; display: flex; flex-direction: column; }
.cp-chat-slot > * { flex: 1 1 auto; min-height: 0; }
`;
