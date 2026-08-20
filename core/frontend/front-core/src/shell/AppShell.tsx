import { useUnit } from "effector-preact";
import {
	$actionCatalog,
	actionCommand,
	installEffectorTrafficLogger,
} from "front-core/core";
import type { ComponentChildren } from "preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type { RightPanelTab } from "sidebar-controller";
import { authToken } from "../auth-token";
import type { ChatConfig } from "../chat/config";
import { mountLinkedChatStyles } from "../chat/styles/link";
import { LogOut } from "../icons";
import { LandingView } from "../landing/LandingView";
import type { LandingPayload } from "../landing/types";
import { AttachButton, PanelToggle } from "../ui/buttons";
import { Composer } from "../ui/Composer";
import { WithTooltip } from "../ui/tooltip";
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
import { Surface } from "./SurfaceView";
import { $currentSurface } from "./surface";
import "./workspace-presenter";

installEffectorTrafficLogger();

type ChatModule = typeof import("../chat");
type Chat = Awaited<ReturnType<ChatModule["initChat"]>>;

const panelTabs: Array<{ id: RightPanelTab; label: string }> = [
	{ id: "commands", label: "Commands" },
	{ id: "chat", label: "Chat" },
	{ id: "events", label: "Events" },
];

function FunctionList({
	functions,
	query,
	onRun,
}: {
	functions: Array<{
		id: string;
		brief?: string;
		category?: string;
		description: string;
	}>;
	query: string;
	onRun: (actionId: string) => void;
}) {
	const categoryOf = (fn: (typeof functions)[number]) =>
		fn.category?.trim() || fn.id.split(".", 1)[0] || "other";
	const normalizedQuery = query
		.trimStart()
		.replace(/^\/+/, "")
		.toLocaleLowerCase()
		.trim();

	if (functions.length === 0) {
		return <p class="panel-empty-state">Loading system functions...</p>;
	}

	const matchedFunctions = functions.filter(
		(fn) =>
			!normalizedQuery ||
			[fn.id, fn.category, fn.brief, fn.description].some((value) =>
				value?.toLocaleLowerCase().includes(normalizedQuery),
			),
	);
	const groups = matchedFunctions.reduce<Map<string, typeof matchedFunctions>>(
		(grouped, fn) => {
			const category = categoryOf(fn);
			grouped.set(category, [...(grouped.get(category) ?? []), fn]);
			return grouped;
		},
		new Map(),
	);

	if (groups.size === 0) {
		return <p class="panel-empty-state">No matching system functions.</p>;
	}

	return (
		<div class="panel-commands">
			{Array.from(groups)
				.sort(([leftCategory, leftActions], [rightCategory, rightActions]) => {
					const count = rightActions.length - leftActions.length;
					return count === 0
						? leftCategory.localeCompare(rightCategory)
						: count;
				})
				.map(([category, actions]) => {
					return (
						<section class="panel-command-section" key={category}>
							<div class="panel-command-heading">
								<span>{category}</span>
								<p>{actions.length}</p>
							</div>
							{actions.map((action) => (
								<button
									type="button"
									class="panel-command-item"
									key={action.id}
									onClick={() => onRun(action.id)}
									title={`${action.id}: ${action.brief || action.description}`}
								>
									<span class="panel-command-title">
										{action.brief || action.description}
									</span>
									<code>{action.id}</code>
								</button>
							))}
						</section>
					);
				})}
		</div>
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
		async ([module, { createMicrofrontendCatalog }]) => ({
			module,
			chat: await module.initChat(
				config,
				mountLinkedChatStyles,
				createMicrofrontendCatalog(),
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
	const surface = useUnit($currentSurface);
	const placement = useUnit($composerPlacement);
	const shellPlacement =
		!landing && placement === "hero" ? "floating" : placement;
	const isPanelOpen = useUnit($panelOpen);
	const draft = useUnit($draft);
	const panelTab = useUnit($panelTab);
	const panelEvents = useUnit($panelEvents);
	const actionCatalog = useUnit($actionCatalog);
	const panelWidth = useUnit($panelWidth);
	const isResizing = useUnit($panelResizing);
	const isAuthenticated = useUserStatus();

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
			requestAnimationFrame(() => inputRef.current?.focus());
		}
	}, [shellPlacement]);

	const ready = async () => {
		const loaded = await loadChat(config);
		setChat(loaded);
		return loaded.chat;
	};

	const send = () => {
		const text = draft.trim();
		if (!text) return;
		const requestedAction = text.startsWith("/")
			? actionCatalog.find((action) => `/${action.id}` === text)
			: undefined;
		if (requestedAction) {
			runFunction(requestedAction.id);
			return;
		}
		if (text.startsWith("/")) return;

		draftCleared();
		panelOpened();
		panelTabActivated("chat");
		panelEventRecorded("Message sent");
		if (inputRef.current) inputRef.current.style.height = "";
		void ready().then((instance) => instance.sendMessage(text));
	};

	const attach = (files: File[]) => {
		if (files.length === 0) return;
		panelOpened();
		panelEventRecorded(
			`Attached ${files.length} file${files.length === 1 ? "" : "s"}`,
		);
		void ready().then((instance) => instance.attachFiles(files));
	};

	const runFunction = (actionId: string) => {
		draftCleared();
		panelEventRecorded(`Function started: ${actionId}`);
		void actionCommand({ actionId, source: "user" }).then(
			() => panelEventRecorded(`Function completed: ${actionId}`),
			() => panelEventRecorded(`Function failed: ${actionId}`),
		);
	};

	const logout = () => {
		panelEventRecorded("Logout requested");
		void actionCommand({ actionId: "auth.logout", source: "user" }).catch(
			() => {
				panelEventRecorded("Logout failed");
			},
		);
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
				<WithTooltip label="Прикрепить файл">
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
				{surface ? <Surface brand={brand} /> : null}
				{landing ? (
					<LandingView
						payload={landing}
						hidden={Boolean(surface)}
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
						<span class="panel-label">
							hw<span>.</span>
						</span>
						<div class="panel-user-actions">
							<span
								class="chat-user-status"
								data-authenticated={isAuthenticated ? "true" : "false"}
							>
								<i aria-hidden="true" />
								{isAuthenticated ? "Вход выполнен" : "Гость"}
							</span>
							{isAuthenticated ? (
								<button
									type="button"
									class="panel-logout"
									aria-label="Выйти"
									title="Выйти"
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
						{panelTab === "chat" ? (
							chat ? (
								<chat.module.Transcript />
							) : (
								<div class="panel-messages" />
							)
						) : null}
						{panelTab === "commands" ? (
							<FunctionList
								functions={actionCatalog}
								query={draft}
								onRun={runFunction}
							/>
						) : null}
						{panelTab === "events" ? (
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
					</div>
					<div class="panel-tabs" aria-label="Chat panel tabs" role="tablist">
						{panelTabs.map((tab) => (
							<button
								type="button"
								role="tab"
								aria-controls="chat-panel-content"
								aria-selected={panelTab === tab.id}
								class={panelTab === tab.id ? "is-active" : undefined}
								onClick={() => panelTabActivated(tab.id)}
							>
								{tab.label}
							</button>
						))}
					</div>
					{composer(true)}
				</aside>
			) : null}
		</main>
	);
}
