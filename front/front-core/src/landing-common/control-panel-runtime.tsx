import {
	Activity,
	BadgeCheck,
	CalendarClock,
	ClipboardCheck,
	ClipboardList,
	Factory,
	FileText,
	PackageCheck,
	Ruler,
	Search,
	Upload,
	Wrench,
	type LucideIcon,
} from "lucide-react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { useUnit } from "effector-react";
import { ControlPanel } from "../components/control-panel/ControlPanel";
import { rightRailActionSelected } from "../components/right-rail/uri-sync";
import { SidebarProvider } from "../components/ui/sidebar";
import { runActionEvent } from "../controllers";
import { useGlobalTranslation } from "../hooks/global_i18n";
import { SlotProvider } from "../slots/SlotProvider";
import { $slotContents } from "../slots/slots";
import { MenuView } from "../views/MenuView";
import type { ReactNode } from "react";
import {
	$controlPanelMode,
	$panelActions,
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
	MENU_TAB_ID,
	menuLinksSet,
	panelActionsSet,
	panelActionTriggered,
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
import {
	LANDING_QUICK_ACTIONS_EVENT,
	readPublishedLandingQuickActions,
	type LandingQuickAction,
} from "./landing-quick-actions";
import { WebCallWidget } from "./WebCallWidget";
import "./control-panel-runtime.css";

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

const defaultScreens: RailScreen[] = [
	{ id: "feed", label: "Feed", icon: <Activity size={18} /> },
	{ id: "orders", label: "Orders", icon: <PackageCheck size={18} /> },
	{ id: "request", label: "Request", detail: "intake", icon: <Wrench size={18} /> },
];

const actionIconByName: Record<string, LucideIcon> = {
	BadgeCheck,
	CalendarClock,
	ClipboardCheck,
	ClipboardList,
	Factory,
	FileText,
	PackageCheck,
	Ruler,
	Search,
	Upload,
	Wrench,
};

const actionIconByLabel: Array<[RegExp, LucideIcon]> = [
	[/find|compan/i, Search],
	[/place|order/i, Factory],
	[/status|check drawing|drawing/i, BadgeCheck],
	[/quote|request/i, ClipboardList],
	[/upload|file/i, Upload],
	[/deadline|date/i, CalendarClock],
	[/material/i, PackageCheck],
	[/tolerance/i, Ruler],
];

function normalizeLandingPanelActions(value: unknown): PanelAction[] {
	const list = Array.isArray(value) ? value : [];
	return list.flatMap((item, index): PanelAction[] => {
		if (!item || typeof item !== "object") return [];
		const action = item as LandingQuickAction;
		const label = typeof action.label === "string" ? action.label.trim() : "";
		const prompt = typeof action.prompt === "string" ? action.prompt : "";
		if (!label || !prompt.trim()) return [];
		const iconName = typeof action.icon === "string" ? action.icon.trim() : "";
		const Icon =
			(iconName && actionIconByName[iconName]) ||
			actionIconByLabel.find(([pattern]) => pattern.test(label))?.[1] ||
			FileText;
		return [{
			id: action.id || toActionId(label, index),
			icon: <Icon size={16} />,
			label,
			prompt,
		}];
	});
}

function readHeroChipPanelActionsFromDom(): PanelAction[] {
	if (typeof document === "undefined") return [];
	const chips = Array.from(
		document.querySelectorAll<HTMLButtonElement>(".hsl-chip[data-hero-prompt]"),
	);
	return normalizeLandingPanelActions(
		chips.map((chip, index) => ({
			id: chip.dataset.heroActionId || toActionId(chip.textContent ?? "", index),
			icon: chip.dataset.heroIcon,
			label: chip.textContent ?? "",
			prompt: chip.dataset.heroPrompt ?? "",
		})),
	);
}

function readInitialLandingPanelActions(): PanelAction[] {
	const published = normalizeLandingPanelActions(readPublishedLandingQuickActions());
	return published.length > 0 ? published : readHeroChipPanelActionsFromDom();
}

function toActionId(label: string, index: number): string {
	const slug = label
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return slug || `panel-action-${index + 1}`;
}

function ChatSlot() {
	const [contents, actions] = useUnit([$slotContents, $panelActions]);
	const { t } = useGlobalTranslation("control-panel");
	// mf-assistants presents into "sidebar:right". We render the slot inline here
	// instead of using the DOM-id + portal mechanism — that would either lose
	// content (when SlotProvider isn't the owner) or duplicate it (causing React
	// removeChild errors when the same element is rendered both via portal and
	// inline).
	const chat = contents["sidebar:right"];
	return (
		<div className="cp-slots cp-chat-slot">
			{chat ?? (
				<div className="ssr-right-rail-empty">
					<h3>{t("empty.title", "AI Assistant")}</h3>
					<p>{t("empty.description", "Ask about services, files, orders, certificates, contacts, or what to do next. This panel is the chat-first control layer for the portal.")}</p>
					{actions.length > 0 && (
						<div className="crp-quick-actions crp-quick-actions--assistant" aria-label={t("empty.actionsLabel", "Assistant actions")}>
							{actions.map((action) => (
								<button
									key={action.id}
									className="crp-quick-action"
									type="button"
									onClick={() => panelActionTriggered(action.prompt)}
								>
									{action.icon}
									{action.label}
								</button>
							))}
						</div>
					)}
				</div>
			)}
		</div>
	);
}

function MenuTab() {
	return (
		<SidebarProvider className="min-h-0 w-full flex-1 bg-transparent" defaultOpen>
			<MenuView
				onClick={(actionId) => {
					rightRailActionSelected(actionId);
					runActionEvent({ actionId, params: {} });
				}}
			/>
		</SidebarProvider>
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
	panelActionsSet(options.actions ?? readInitialLandingPanelActions());
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
	const handleLandingQuickActions = (event: Event) => {
		if (options.actions) return;
		const actions = normalizeLandingPanelActions(
			(event as CustomEvent<{ actions?: unknown }>).detail?.actions,
		);
		panelActionsSet(actions.length > 0 ? actions : readHeroChipPanelActionsFromDom());
	};
	window.addEventListener(LANDING_QUICK_ACTIONS_EVENT, handleLandingQuickActions);
	const syncHeroChipActions = () => {
		if (options.actions) return;
		const actions = readHeroChipPanelActionsFromDom();
		if (actions.length > 0) panelActionsSet(actions);
	};
	const heroChipObserver =
		typeof MutationObserver !== "undefined"
			? new MutationObserver(syncHeroChipActions)
			: null;
	if (heroChipObserver) {
		heroChipObserver.observe(document.body, {
			childList: true,
			subtree: true,
		});
	}
	window.requestAnimationFrame(syncHeroChipActions);

	// ── 3. Render ControlPanel with mode-driven swap ─────────────────────────
	let root: Root | null = createRoot(host);
	const renderMode = (mode: ControlPanelMode) => {
		host.dataset.mode = mode;
		if (!root) return;
		const tabContents = options.isAuthenticated()
			? {
					[MENU_TAB_ID]: <MenuTab />,
					...options.tabContents,
				}
			: options.tabContents;
		flushSync(() => {
			root?.render(
				<div className={options.isDark ? "cp-runtime dark" : "cp-runtime"} data-mode={mode}>
					<ControlPanel
						chatSlot={<ChatSlot />}
						composerPlaceholder={options.chatPlaceholder}
						tabContents={tabContents}
					/>
					{/* SlotProvider must be rendered unconditionally so portals into
					    #slot-panel-tab keep working across tab switches. */}
					<SlotProvider />
					{/* Floating "call from website" status pill (public + app modes). */}
					<WebCallWidget />
				</div>,
			);
		});
		if (mode === "app") options.onAppModeRendered?.();
	};
	const syncAuthState = () => {
		authStateChanged(options.isAuthenticated());
		renderMode($controlPanelMode.getState());
	};
	window.addEventListener("auth-token-changed", syncAuthState);
	const unwatch = $controlPanelMode.watch(renderMode);

	return {
		setMode: (mode) => {
			if (mode === "app") controlPanelOpened();
			else controlPanelClosed();
		},
		unmount: () => {
			unwatch();
			window.removeEventListener("auth-token-changed", syncAuthState);
			window.removeEventListener(LANDING_QUICK_ACTIONS_EVENT, handleLandingQuickActions);
			heroChipObserver?.disconnect();
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

