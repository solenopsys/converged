import { useUnit } from "effector-preact";
import { installEffectorTrafficLogger } from "front-core/core";
import {
	$objectRegistryRevision,
	executeOperation,
	objectResolver,
} from "front-core/object-runtime";
import { translator } from "i18n";
import type { Entry } from "orchestrator";
import type { ComponentChildren } from "preact";
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "preact/hooks";
import { authToken } from "../auth-token";
import type { ChatConfig } from "../chat/config";
import { CHAT_MESSAGES_NAMESPACE } from "../chat/i18n";
import { mountLinkedChatStyles } from "../chat/styles/link";
import { type MagicPrompt, MagicPrompts } from "../chat/ui/MagicPrompts";
import { Copy, LogOut } from "../icons";
import { LandingView } from "../landing/LandingView";
import type { LandingPayload } from "../landing/types";
import { setActiveSelectionResolver } from "../select/runtime";
import { AttachButton, PanelToggle } from "../ui/buttons";
import { Composer } from "../ui/Composer";
import { WithTooltip } from "../ui/tooltip";
import { ConsoleRoot } from "./ConsoleRoot";
import { availableChatPanelTabs, resolveChatPanelTab } from "./chat-panel-tabs";
import {
	$composerPlacement,
	$draft,
	$panelEvents,
	$panelOpen,
	$panelResizing,
	$panelTab,
	$panelWidth,
	draftChanged,
	draftCleared,
	pageScrolled,
	panelEventRecorded,
	panelOpened,
	panelResizeFinished,
	panelResizeStarted,
	panelTabActivated,
	panelToggled,
	panelWidthChanged,
} from "./panel";
import { SurfaceNav } from "./SurfaceNav";
import { Surface } from "./SurfaceView";
import {
	$activeSurface,
	$pressedSubtab,
	$surfaceTabs,
	workspaceReset,
} from "./workspace";
import { isConsolePath } from "./workspace-url";
import "./reference-presenter";
import "./legacy-widget-presenter";
import {
	installWorkspaceReader,
	registerWorkspaceSurface,
} from "./workspace-surface";

installEffectorTrafficLogger();
// Where the user is standing, for the deciding steps to read. Free of charge:
// it publishes nothing to the catalog.
installWorkspaceReader();

type ChatModule = typeof import("../chat");
type Chat = Awaited<ReturnType<ChatModule["initChat"]>>;

declare const __EFFECTOR_DEBUG__: boolean;

// SSR loads this source before Bun applies browser build defines.
const t = translator(CHAT_MESSAGES_NAMESPACE);

const devTraceEnabled =
	typeof __EFFECTOR_DEBUG__ !== "undefined" && __EFFECTOR_DEBUG__;

const CONVERGED_LOGO_URL = "/assets/converged.svg";

function isConsoleRoute(): boolean {
	return (
		typeof window !== "undefined" && isConsolePath(window.location.pathname)
	);
}

function defaultMagicPrompts(language: string): MagicPrompt[] {
	const action = language.toLocaleLowerCase().startsWith("ru")
		? "Покажи"
		: "Show";
	const seen = new Set<string>();
	return objectResolver
		.resolve("select", { discovery: "panel" })
		.flatMap((candidate) => {
			const targetType = candidate.targetType;
			if (!targetType || seen.has(targetType)) return [];
			seen.add(targetType);
			return [candidate];
		})
		.slice(0, 6)
		.map((candidate) => ({
			id: `select:${candidate.id}`,
			label: `${action} ${candidate.label}`,
			message: `${action} ${candidate.label}`,
		}));
}

function json(value: unknown): string {
	try {
		return JSON.stringify(value, null, 2) ?? "undefined";
	} catch {
		return String(value);
	}
}

function formatTime(at: number): string {
	return new Intl.DateTimeFormat(undefined, {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		fractionalSecondDigits: 3,
	}).format(at);
}

function OrchestratorTrace({ chat }: { chat: Chat }) {
	const entries = useUnit(chat.store.conversation.entries.$entries);
	const [copied, setCopied] = useState(false);
	const trace = Array.from(entries.values())
		.filter(
			(entry): entry is Extract<Entry, { kind: "step" | "call" }> =>
				entry.kind === "step" || entry.kind === "call",
		)
		.sort((left, right) => left.at - right.at);

	if (trace.length === 0) {
		return <p class="panel-empty-state">No orchestration activity yet.</p>;
	}

	const copyAll = async () => {
		const text = json(
			trace.map((entry) =>
				entry.kind === "step"
					? {
							at: new Date(entry.at).toISOString(),
							kind: entry.kind,
							phase: entry.phase,
							step: entry.step,
							tier: entry.tier,
							status: entry.status,
							elapsedMs: entry.elapsedMs,
							input: entry.input,
							outcome: entry.outcome,
						}
					: {
							at: new Date(entry.at).toISOString(),
							kind: entry.kind,
							name: entry.name,
							callId: entry.callId,
							status: entry.status,
							elapsedMs: entry.elapsedMs,
							args: entry.args,
							result: entry.result,
							error: entry.error,
						},
			),
		);
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1500);
		} catch {
			setCopied(false);
		}
	};

	return (
		<>
			<div class="panel-trace-toolbar">
				<button
					type="button"
					class="panel-trace-copy"
					onClick={() => void copyAll()}
					title="Copy all trace entries"
					aria-label="Copy all trace entries"
				>
					<Copy aria-hidden="true" size={14} />
					{copied ? "Copied" : "Copy all"}
				</button>
			</div>
			<ol class="panel-trace">
				{trace.map((entry) => (
					<li key={entry.id} data-status={entry.status}>
						<header>
							<code>
								{entry.kind === "step"
									? `${entry.phase}:${entry.step} [${entry.tier}]`
									: `call:${entry.name}`}
							</code>
							<span>
								{entry.elapsedMs === undefined
									? "running"
									: `${entry.elapsedMs} ms`}
							</span>
							<time>{formatTime(entry.at)}</time>
						</header>
						<pre>
							{entry.kind === "step"
								? json({ input: entry.input, outcome: entry.outcome })
								: json({
										args: entry.args,
										result: entry.result,
										error: entry.error,
									})}
						</pre>
					</li>
				))}
			</ol>
		</>
	);
}

const MIN_PANEL_WIDTH = 300;
const MAX_PANEL_WIDTH = 720;

function clampPanelWidth(width: number): number {
	const viewportLimit =
		typeof window === "undefined"
			? MAX_PANEL_WIDTH
			: Math.max(MIN_PANEL_WIDTH, window.innerWidth - 32);
	return Math.round(
		Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, viewportLimit, width)),
	);
}

function useUserStatus(): boolean {
	const [isAuthenticated, setIsAuthenticated] = useState(() =>
		authToken.isAuthenticated(),
	);

	useEffect(() => {
		const sync = () => setIsAuthenticated(authToken.isAuthenticated());
		window.addEventListener("auth-token-changed", sync);
		window.addEventListener("storage", sync);
		return () => {
			window.removeEventListener("auth-token-changed", sync);
			window.removeEventListener("storage", sync);
		};
	}, []);

	return isAuthenticated;
}

let loading: Promise<{ module: ChatModule; chat: Chat }> | null = null;

function loadChat(config: ChatConfig) {
	loading ??= Promise.all([import("../chat"), import("../chat/catalog")]).then(
		async ([module, { createSurfaceCatalog }]) => ({
			module,
			chat: await module.initChat(
				config,
				mountLinkedChatStyles,
				createSurfaceCatalog(),
			),
		}),
	);
	return loading;
}

function warmUpChat(config: ChatConfig) {
	const start = () => void loadChat(config);
	if (typeof requestIdleCallback === "function") {
		requestIdleCallback(start, { timeout: 500 });
	} else {
		setTimeout(start, 0);
	}
}

export function AppShell({
	config,
	landing,
	brand,
	children,
}: {
	config: ChatConfig;
	landing?: LandingPayload;
	children?: ComponentChildren;

	brand: ComponentChildren;
}) {
	const [chat, setChat] = useState<{ module: ChatModule; chat: Chat } | null>(
		null,
	);
	const inputRef = useRef<HTMLTextAreaElement>(null);
	// The stage is up as soon as a surface is mounted — a surface with no
	// button pressed shows its own screen, which is the normal resting state.
	const surface = useUnit($activeSurface);
	const placement = useUnit($composerPlacement);
	const shellPlacement =
		!landing && placement === "hero" ? "floating" : placement;
	const isPanelOpen = useUnit($panelOpen);
	const draft = useUnit($draft);
	const panelTab = useUnit($panelTab);
	const panelEvents = useUnit($panelEvents);
	const objectRegistryRevision = useUnit($objectRegistryRevision);
	const panelWidth = useUnit($panelWidth);
	const isResizing = useUnit($panelResizing);
	const isAuthenticated = useUserStatus();
	const surfaceTabs = useUnit($surfaceTabs);
	const availableTabs = availableChatPanelTabs({
		isAuthenticated,
		isDevelopment: devTraceEnabled,
		// Nothing to navigate to means no menu. For a guest that is the usual
		// case: the sections it could reach are the ones it is permitted.
		hasSurfaces: surfaceTabs.length > 0,
	});
	const activePanelTab = resolveChatPanelTab(panelTab, availableTabs);
	const magicPrompts = useMemo(
		() => defaultMagicPrompts(config.language),
		[config.language, objectRegistryRevision],
	);

	useEffect(() => {
		setActiveSelectionResolver(() => {
			const pressed = $pressedSubtab.getState();
			return pressed?.ref?.kind === "set"
				? { ref: pressed.ref, tabKey: pressed.key }
				: null;
		});
		return () => setActiveSelectionResolver(undefined);
	}, []);

	// The shell's own navigation, callable like any other function — this is what
	// lets an orchestrator step commit its choice to the screen. Skipped for the
	// old flow, which would only see three more entries it never calls.
	useEffect(() => {
		if (!config.functionFlow) registerWorkspaceSurface();
	}, [config.functionFlow]);

	useEffect(() => {
		warmUpChat(config);
	}, [config]);

	useEffect(() => {
		const report = () =>
			pageScrolled({ offset: window.scrollY, viewport: window.innerHeight });

		report();
		window.addEventListener("scroll", report, { passive: true });
		return () => window.removeEventListener("scroll", report);
	}, []);

	useEffect(() => {
		if (shellPlacement === "panel") {
			void mountLinkedChatStyles();
			requestAnimationFrame(() => inputRef.current?.focus());
		}
	}, [shellPlacement]);

	useEffect(() => {
		if (activePanelTab !== panelTab) panelTabActivated(activePanelTab);
	}, [activePanelTab, panelTab]);

	const ready = async () => {
		const loaded = await loadChat(config);
		setChat(loaded);
		return loaded.chat;
	};

	const send = (submitted?: string) => {
		const text = (submitted ?? draft).trim();
		if (!text) return;

		draftCleared();
		panelOpened();
		panelTabActivated("chat");
		panelEventRecorded("Message sent");
		if (inputRef.current) inputRef.current.style.height = "";
		void ready().then((instance) => instance.sendMessage(text));
	};

	const submitMagicPrompt = (message: string) => {
		draftChanged(message);
		requestAnimationFrame(() => send(message));
	};

	const attach = (files: File[]) => {
		if (files.length === 0) return;
		panelOpened();
		panelEventRecorded(
			`Attached ${files.length} file${files.length === 1 ? "" : "s"}`,
		);
		void ready().then((instance) => instance.attachFiles(files));
	};

	const logout = () => {
		panelEventRecorded("Logout requested");
		void executeOperation({
			operationId: "auth.session.logout",
			source: "user",
		}).catch(() => {
			panelEventRecorded("Logout failed");
		});
	};

	const updatePanelWidth = useCallback((width: number) => {
		panelWidthChanged(clampPanelWidth(width));
	}, []);

	const resizePanel = useCallback(
		(event: PointerEvent) => {
			if (window.matchMedia("(max-width: 680px)").matches) return;

			event.preventDefault();
			const startX = event.clientX;
			const startWidth = panelWidth;
			const previousUserSelect = document.body.style.userSelect;
			const previousCursor = document.body.style.cursor;

			document.body.style.userSelect = "none";
			document.body.style.cursor = "col-resize";
			panelResizeStarted();

			const cleanup = () => {
				document.body.style.userSelect = previousUserSelect;
				document.body.style.cursor = previousCursor;
				panelResizeFinished();
				window.removeEventListener("pointermove", onPointerMove);
				window.removeEventListener("pointerup", cleanup);
				window.removeEventListener("pointercancel", cleanup);
			};
			const onPointerMove = (moveEvent: globalThis.PointerEvent) => {
				updatePanelWidth(startWidth + startX - moveEvent.clientX);
			};

			window.addEventListener("pointermove", onPointerMove);
			window.addEventListener("pointerup", cleanup);
			window.addEventListener("pointercancel", cleanup);
		},
		[panelWidth, updatePanelWidth],
	);

	const composer = (panel: boolean) => (
		<Composer
			id={panel ? "panel-message" : "hero-message"}
			draft={draft}
			inputRef={inputRef}
			callConfig={{
				fujinWsUrl: config.fujinWsUrl,
				contextName: config.callContextName,
			}}
			dictationConfig={{
				fujinWsUrl: config.fujinWsUrl,
				language: config.language,
			}}
			attach={({ onClick }) => (
				<WithTooltip label={t("panel.attachFile")}>
					{(triggerProps) => (
						<AttachButton onClick={onClick} triggerProps={triggerProps} />
					)}
				</WithTooltip>
			)}
			action={<PanelToggle open={panel} onClick={panelToggled} />}
			onDraftChange={draftChanged}
			onFiles={attach}
			onSubmit={send}
			onFocus={() => void loadChat(config)}
		/>
	);

	return (
		<main
			class={`app-shell ${isPanelOpen ? "is-panel-open" : ""}`}
			style={{ "--hw-panel-stage-offset": `${panelWidth}px` }}
		>
			<div class="app-shell-stage">
				{surface ? (
					<Surface brand={brand} onBrandClick={workspaceReset} />
				) : null}
				{!surface && isConsoleRoute() ? <ConsoleRoot brand={brand} /> : null}
				{landing ? (
					<LandingView
						payload={landing}
						hidden={Boolean(surface) || isConsoleRoute()}
						composer={shellPlacement === "hero" ? composer(false) : null}
					/>
				) : (
					<div hidden={Boolean(surface)}>{children}</div>
				)}
			</div>

			{shellPlacement === "floating" ? (
				<div class="minimized-toggle">
					<PanelToggle open={false} onClick={panelOpened} />
				</div>
			) : null}

			{shellPlacement === "panel" ? (
				<aside
					class="chat-panel"
					aria-label="Chat panel"
					data-resizing={isResizing ? "true" : undefined}
					style={{ "--hw-panel-width": `${panelWidth}px` }}
				>
					<button
						type="button"
						class="chat-panel-resizer"
						aria-label="Resize chat panel"
						title="Resize chat panel"
						onPointerDown={resizePanel}
						onKeyDown={(event) => {
							if (event.key !== "ArrowLeft" && event.key !== "ArrowRight")
								return;
							event.preventDefault();
							const step = event.shiftKey ? 40 : 16;
							updatePanelWidth(
								panelWidth + (event.key === "ArrowLeft" ? step : -step),
							);
						}}
					/>
					<header class="panel-header">
						<img
							class="panel-label-logo"
							src={CONVERGED_LOGO_URL}
							alt="Converged"
						/>
						<div class="panel-user-actions">
							<span
								class="chat-user-status"
								data-authenticated={isAuthenticated ? "true" : "false"}
							>
								<i aria-hidden="true" />
								{isAuthenticated
									? t("shell.authenticatedStatus")
									: t("shell.guestStatus")}
							</span>
							{isAuthenticated ? (
								<button
									type="button"
									class="panel-logout"
									aria-label={t("shell.logout")}
									title={t("shell.logout")}
									onClick={logout}
								>
									<LogOut aria-hidden="true" size={15} />
								</button>
							) : null}
						</div>
					</header>
					<div
						class="panel-tab-content"
						id="chat-panel-content"
						role="tabpanel"
					>
						{activePanelTab === "chat" ? (
							chat ? (
								<chat.module.Transcript
									magicPrompts={magicPrompts}
									onMagicPrompt={submitMagicPrompt}
								/>
							) : (
								<div class="panel-messages">
									<MagicPrompts
										prompts={magicPrompts}
										onSubmit={submitMagicPrompt}
									/>
								</div>
							)
						) : null}
						{activePanelTab === "navigation" ? <SurfaceNav /> : null}
						{activePanelTab === "events" ? (
							panelEvents.length > 0 ? (
								<ol class="panel-events">
									{panelEvents.map((event) => (
										<li key={event.id}>
											<span>{event.label}</span>
											<time>
												{new Intl.DateTimeFormat(undefined, {
													hour: "2-digit",
													minute: "2-digit",
												}).format(event.at)}
											</time>
										</li>
									))}
								</ol>
							) : (
								<p class="panel-empty-state">No events yet.</p>
							)
						) : null}
						{activePanelTab === "trace" && devTraceEnabled ? (
							chat ? (
								<OrchestratorTrace chat={chat.chat} />
							) : (
								<p class="panel-empty-state">Chat is not initialized.</p>
							)
						) : null}
					</div>
					{availableTabs.length > 1 ? (
						<div class="panel-tabs" aria-label="Chat panel tabs" role="tablist">
							{availableTabs.map((tab) => (
								<button
									type="button"
									role="tab"
									aria-controls="chat-panel-content"
									aria-selected={activePanelTab === tab.id}
									class={activePanelTab === tab.id ? "is-active" : undefined}
									onClick={() => panelTabActivated(tab.id)}
								>
									{tab.label}
								</button>
							))}
						</div>
					) : null}
					{composer(true)}
				</aside>
			) : null}
		</main>
	);
}
