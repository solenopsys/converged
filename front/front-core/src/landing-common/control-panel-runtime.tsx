import {
	Activity,
	BadgeCheck,
	CalendarClock,
	ClipboardCheck,
	Globe2,
	LogIn,
	Moon,
	PackageCheck,
	PanelLeftClose,
	Ruler,
	Sun,
	Upload,
	Wrench,
} from "lucide-react";
import { useState } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import {
	ConvergedRailPanel,
	type RailQuickAction,
	type RailScreen,
} from "../components/converged-rail-panel/ConvergedRailPanel";
import {
	LandingTopBar,
	type LandingTopBarAction,
	type LandingTopBarMenuLink,
} from "../components/landing-topbar/LandingTopBar";
import { Button } from "../components/ui";
import { SlotProvider } from "../slots/SlotProvider";
import {
	$controlPanelMode,
	controlPanelClosed,
	controlPanelModeChanged,
	controlPanelOpened,
	type ControlPanelMode,
} from "./control-panel-model";

export interface ControlPanelRuntimeOptions {
	logoLight?: string;
	logoDark?: string;
	phone?: string;
	statusText?: string;
	chatPlaceholder?: string;
	menuLinks?: LandingTopBarMenuLink[];
	loginEnabled: boolean;
	languages: Array<{ code: string; label: string }>;
	currentLanguage: string;
	isDark: boolean;
	isAuthenticated: () => boolean;
	onAppModeRendered?: () => void;
	onOpenChat: (message?: string) => void;
	onAttach: () => void;
	onLogin: () => void;
	onLogout: () => void;
	onThemeToggle: () => boolean;
	onLanguage: (code: string) => void;
}

export interface ControlPanelRuntimeHandle {
	setMode: (mode: ControlPanelMode) => void;
	unmount: () => void;
}

const topBarActions: LandingTopBarAction[] = [
	{
		icon: <BadgeCheck size={16} />,
		label: "Check drawing",
		prompt: "Check this drawing: ",
	},
	{
		icon: <Upload size={16} />,
		label: "Upload file",
		prompt: "I want to upload a file for review.",
	},
	{
		icon: <CalendarClock size={16} />,
		label: "Estimate deadline",
		prompt: "Estimate deadline: ",
	},
	{
		icon: <ClipboardCheck size={16} />,
		label: "Request quote",
		prompt: "Prepare a quote: ",
	},
	{
		icon: <PackageCheck size={16} />,
		label: "Choose material",
		prompt: "Help me choose material: ",
	},
	{
		icon: <Ruler size={16} />,
		label: "Check tolerances",
		prompt: "Check tolerances: ",
	},
];

const railQuickActions: RailQuickAction[] = [
	{
		id: "check",
		label: "Check drawing",
		prompt: "Check the drawing for the open order.",
		icon: <BadgeCheck size={16} />,
	},
	{
		id: "upload",
		label: "Upload file",
		prompt: "Prepare a file upload for the current order.",
		icon: <Upload size={16} />,
	},
	{
		id: "deadline",
		label: "Estimate deadline",
		prompt: "Estimate the deadline for the current order.",
		icon: <CalendarClock size={16} />,
	},
];

const initialScreens: RailScreen[] = [
	{ id: "feed", label: "Feed", icon: <Activity size={18} /> },
	{ id: "orders", label: "Orders", icon: <PackageCheck size={18} /> },
	{
		id: "request",
		label: "Request",
		detail: "intake",
		icon: <Wrench size={18} />,
	},
];

function ControlPanelApp({
	mode,
	setMode,
	options,
}: {
	mode: ControlPanelMode;
	setMode: (mode: ControlPanelMode) => void;
	options: ControlPanelRuntimeOptions;
}) {
	const [isDark, setIsDark] = useState(options.isDark);
	const [lang, setLang] = useState(options.currentLanguage);
	const [langOpen, setLangOpen] = useState(false);
	const [topbarValue, setTopbarValue] = useState("");
	const [composerValue, setComposerValue] = useState("");
	const [screens, setScreens] = useState(initialScreens);
	const [activeScreen, setActiveScreen] = useState(initialScreens[0]?.id ?? "");

	const toggleTheme = () => {
		setIsDark(options.onThemeToggle());
	};

	const changeLanguage = (code: string) => {
		setLang(code);
		setLangOpen(false);
		options.onLanguage(code);
	};

	const openChat = (message?: string) => {
		setMode("app");
		options.onOpenChat(message);
	};

	const attachFile = () => {
		setMode("app");
		options.onAttach();
	};

	const submitComposer = () => {
		const text = composerValue.trim();
		if (!text) return;
		setComposerValue("");
		openChat(text);
	};

	const railControls = (
		<div className="cp-controls">
			{options.loginEnabled ? (
				<Button
					className="ssr-panel-control"
					size="icon"
					variant="ghost"
					type="button"
					aria-label={options.isAuthenticated() ? "Log out" : "Login"}
					onClick={
						options.isAuthenticated() ? options.onLogout : options.onLogin
					}
				>
					<LogIn size={17} />
				</Button>
			) : null}
			<Button
				className="ssr-panel-control"
				size="icon"
				variant="ghost"
				type="button"
				aria-label="Theme"
				onClick={toggleTheme}
			>
				{isDark ? <Sun size={17} /> : <Moon size={17} />}
			</Button>
			<div className="cp-lang" data-open={langOpen ? "1" : "0"}>
				<Button
					aria-expanded={langOpen}
					aria-label="Language"
					className="ssr-panel-control ssr-lang-trigger"
					onClick={() => setLangOpen((current) => !current)}
					size="sm"
					variant="ghost"
					type="button"
				>
					<Globe2 size={17} />
					<span className="ssr-lang-current">{lang.toUpperCase()}</span>
				</Button>
				<div
					className="cp-lang-popover"
					role="menu"
					aria-label="Language options"
				>
					{options.languages.map((item) => (
						<button
							key={item.code}
							className="cp-lang-option"
							type="button"
							role="menuitemradio"
							aria-checked={item.code === lang ? "true" : "false"}
							onClick={() => changeLanguage(item.code)}
						>
							{item.label}
						</button>
					))}
				</div>
			</div>
			{!options.isAuthenticated() ? (
				<Button
					className="ssr-panel-control"
					size="icon"
					variant="ghost"
					type="button"
					aria-label="Back to public topbar"
					onClick={() => setMode("public")}
				>
					<PanelLeftClose size={17} />
				</Button>
			) : null}
		</div>
	);

	const menuSlot = (
		<nav id="ssr-left-panel" className="crp-menu-slot" aria-label="Menu">
			<div className="ssr-panel-groups" data-ssr-menu-groups />
		</nav>
	);

	const chatSlot = (
		<div className="cp-slots">
			<div id="slot-panel-tab" className="cp-tab-slot" />
			<div id="slot-panel-chat" className="cp-chat-slot">
				<div className="ssr-right-rail-empty">
					<h3>AI Assistant</h3>
					<p>Loading...</p>
				</div>
			</div>
			<SlotProvider />
		</div>
	);

	return (
		<div className={isDark ? "cp-runtime dark" : "cp-runtime"} data-mode={mode}>
			<style>{css}</style>
			{mode === "public" ? (
				<LandingTopBar
					logoLight={options.logoLight}
					logoDark={options.logoDark}
					phone={options.phone}
					statusText={options.statusText}
					actions={topBarActions}
					menuLinks={options.menuLinks ?? []}
					languages={options.languages}
					currentLanguage={lang}
					isDark={isDark}
					onThemeToggle={toggleTheme}
					onLanguage={changeLanguage}
					onLogin={options.loginEnabled ? options.onLogin : undefined}
					onPanelOpen={() => setMode("app")}
					value={topbarValue}
					onValueChange={setTopbarValue}
					onSubmit={(text) => {
						setTopbarValue("");
						openChat(text);
					}}
					onAttach={attachFile}
					compact
				/>
			) : (
				<ConvergedRailPanel
					logoLight={options.logoLight}
					logoDark={options.logoDark}
					screens={screens}
					activeScreenId={activeScreen}
					onScreenChange={setActiveScreen}
					onScreenClose={(id) =>
						setScreens((current) =>
							current.filter((screen) => screen.id !== id),
						)
					}
					menuSlot={menuSlot}
					quickActions={railQuickActions}
					onQuickAction={setComposerValue}
					chatSlot={chatSlot}
					composerValue={composerValue}
					onComposerChange={setComposerValue}
					onComposerSubmit={submitComposer}
					onComposerAttach={attachFile}
					composerPlaceholder={
						options.chatPlaceholder ?? "Describe your CNC request..."
					}
					controls={railControls}
				/>
			)}
		</div>
	);
}

export function mountControlPanelRuntime(
	host: HTMLElement,
	options: ControlPanelRuntimeOptions,
): ControlPanelRuntimeHandle {
	let root: Root | null = createRoot(host);

	const setMode = (mode: ControlPanelMode) => {
		if (mode === "app") {
			controlPanelOpened();
		} else {
			controlPanelClosed();
		}
	};

	const renderMode = (mode: ControlPanelMode) => {
		host.dataset.mode = mode;
		if (!root) return;
		flushSync(() => {
			root?.render(
				<ControlPanelApp
					mode={mode}
					setMode={setMode}
					options={options}
				/>,
			);
		});
		if (mode === "app") {
			options.onAppModeRendered?.();
		}
	};

	const unwatch = $controlPanelMode.watch(renderMode);

	return {
		setMode,
		unmount: () => {
			unwatch();
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

const css = `
.cp-runtime {
  width: 100%;
  height: 100%;
}

.cp-runtime[data-mode="public"] {
  height: auto;
}

.cp-runtime[data-mode="app"] {
  height: 100vh;
}

.cp-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.cp-lang {
  position: relative;
}

.cp-lang-popover {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 30;
  display: none;
  min-width: 96px;
  padding: 6px;
  border: 1px solid color-mix(in oklch, var(--ui-border) 88%, transparent);
  border-radius: 10px;
  background: var(--ui-card);
  box-shadow: 0 12px 30px rgba(2, 6, 23, 0.25);
}

.cp-lang[data-open="1"] .cp-lang-popover {
  display: grid;
  gap: 4px;
}

.cp-lang-option {
  width: 100%;
  min-height: 30px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
}

.cp-lang-option:hover,
.cp-lang-option[aria-checked="true"] {
  background: var(--ui-accent);
}

.cp-slots {
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.cp-tab-slot,
.cp-chat-slot {
  min-height: 0;
  min-width: 0;
}

.cp-tab-slot:empty {
  display: none;
}

.cp-chat-slot {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
}

.cp-chat-slot > * {
  flex: 1 1 auto;
  min-height: 0;
}

#ssr-left-panel {
  max-height: 220px;
  border-bottom: 1px solid color-mix(in oklch, var(--ui-border) 74%, transparent);
}
`;
