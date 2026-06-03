"use client";

import { useUnit } from "effector-react";
import { type BusinessEvent, createEventsServiceClient } from "g-events";
import { Gauge } from "lucide-react";
import { type MouseEvent, useEffect, useState } from "react";
import { bus, registry, runActionEvent } from "../../controllers";
import {
	dashboardSlots,
	getDashboardIndicatorsSnapshot,
	layoutReady,
	subscribeDashboardIndicators,
} from "../../slots";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	ScrollArea,
} from "../ui";
import {
	$streamEvents,
	type StreamEvent,
	streamEventsLoaded,
} from "./stateStreamStore";

const eventsClient = createEventsServiceClient({ baseUrl: "/services" });
const EVENTS_LIMIT = 50;
const EVENTS_REFRESH_MS = 2500;
const actionRuntimeModules: Record<string, string> = {
	chats: "mf-assistants",
	requests: "mf-requests",
};
const loadedActionRuntimeModules = new Set<string>();

function getRuntimeBus() {
	if (typeof window === "undefined") return bus;
	return (window as { __BUS__?: typeof bus }).__BUS__ ?? bus;
}

function resolveRuntimeModuleSpecifier(moduleName: string): string {
	if (typeof document === "undefined") return moduleName;

	const script = document.querySelector<HTMLScriptElement>(
		'script[type="importmap"]',
	);
	if (!script?.textContent) return `/mf/${moduleName}.js`;

	try {
		const parsed = JSON.parse(script.textContent) as {
			imports?: Record<string, string>;
		};
		return parsed.imports?.[moduleName] ?? `/mf/${moduleName}.js`;
	} catch {
		return `/mf/${moduleName}.js`;
	}
}

async function ensureActionRegistered(actionId: string): Promise<void> {
	if (registry.get(actionId)) return;

	const prefix = actionId.split(".")[0];
	const moduleName = actionRuntimeModules[prefix];
	if (!moduleName || loadedActionRuntimeModules.has(moduleName)) return;

	try {
		const mod = await import(
			/* @vite-ignore */ resolveRuntimeModuleSpecifier(moduleName)
		);
		const plugin = mod.default ?? mod;
		if (plugin && typeof plugin.plug === "function") {
			plugin.plug(getRuntimeBus());
			loadedActionRuntimeModules.add(moduleName);
		}
	} catch (error) {
		console.error("[StateStream] Failed to load action module", {
			actionId,
			moduleName,
			error,
		});
	}
}

function formatEventTime(value: string): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return new Intl.DateTimeFormat(undefined, {
		hour: "2-digit",
		minute: "2-digit",
	}).format(date);
}

function toStreamEvent(event: BusinessEvent): StreamEvent {
	if (event.type === "chat.created") {
		return {
			id: event.id,
			time: formatEventTime(event.createdAt),
			source: event.service,
			title: "New chat",
			body: "Thread",
			entityId: event.entityId,
			entityLabel: event.entityId,
			tone: "neutral",
			actionId: "chats.view",
			actionParams: { recordId: event.entityId },
		};
	}

	if (event.type === "request.created") {
		return {
			id: event.id,
			time: formatEventTime(event.createdAt),
			source: event.service,
			title: "New request",
			body: "Request",
			entityId: event.entityId,
			entityLabel: event.entityId,
			tone: "attention",
			actionId: "requests.open",
			actionParams: { requestId: event.entityId },
		};
	}

	if (event.type === "file.created") {
		return {
			id: event.id,
			time: formatEventTime(event.createdAt),
			source: event.service,
			title: "New file",
			body: "File",
			entityId: event.entityId,
			entityLabel: event.entityId,
			tone: "positive",
		};
	}

	return {
		id: event.id,
		time: formatEventTime(event.createdAt),
		source: event.service,
		title: event.type,
		body: event.entityId,
		entityId: event.entityId,
		entityLabel: event.entityId,
		tone: "neutral",
	};
}

// ── Stream event row ──────────────────────────────────────────────────────────

function StreamEventRow({ item }: { item: StreamEvent }) {
	const openLinkedEntity = async (event: MouseEvent<HTMLButtonElement>) => {
		event.preventDefault();
		event.stopPropagation();
		if (!item.actionId) return;

		await ensureActionRegistered(item.actionId);
		if (!registry.get(item.actionId)) {
			console.error("[StateStream] Action not registered", {
				eventId: item.id,
				actionId: item.actionId,
				params: item.actionParams ?? {},
			});
			return;
		}

		console.log("[StateStream] Running linked action", {
			eventId: item.id,
			actionId: item.actionId,
			params: item.actionParams ?? {},
		});
		runActionEvent({
			actionId: item.actionId,
			params: item.actionParams ?? {},
		});
	};

	return (
		<article className="min-w-0 rounded-md bg-muted/20 px-3 py-2.5 text-sm transition-colors hover:bg-muted/30">
			<div className="mb-2 flex items-center justify-between gap-3">
				<span className="truncate text-xs text-muted-foreground">
					{item.source}
				</span>
				<time className="shrink-0 text-xs tabular-nums text-muted-foreground">
					{item.time}
				</time>
			</div>
			<h3 className="truncate font-medium leading-5">{item.title}</h3>
			<p className="mt-1 truncate text-xs leading-5 text-muted-foreground">
				{item.body}
				{item.entityId && item.actionId ? (
					<>
						{" "}
						<button
							className="font-mono text-[11px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
							onClick={openLinkedEntity}
							type="button"
						>
							{item.entityLabel ?? item.entityId}
						</button>
					</>
				) : item.entityId ? (
					<> {item.entityLabel ?? item.entityId}</>
				) : null}
			</p>
		</article>
	);
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyEvents() {
	return (
		<div className="flex h-40 flex-col items-center justify-center px-4 text-center text-sm text-muted-foreground">
			<p className="font-medium text-foreground">No events yet</p>
			<p className="mt-1 max-w-sm">Events will appear here as they happen</p>
		</div>
	);
}

function EmptySignals() {
	return (
		<div className="flex h-40 items-center justify-center px-4 text-center text-sm text-muted-foreground">
			No indicators yet. Run any dashboard widget to pin it here.
		</div>
	);
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function StateStreamView() {
	const events = useUnit($streamEvents);
	const [indicators, setIndicators] = useState(getDashboardIndicatorsSnapshot);

	useEffect(() => {
		let cancelled = false;
		layoutReady("dashboard");
		void dashboardSlots.loadIndicators().then((items) => {
			if (!cancelled) {
				setIndicators(items);
			}
		});
		const unsubscribe = subscribeDashboardIndicators(() => {
			setIndicators(getDashboardIndicatorsSnapshot());
		});
		dashboardSlots.restoreWidgets();
		return () => {
			cancelled = true;
			unsubscribe();
			dashboardSlots.saveWidgets();
		};
	}, []);

	useEffect(() => {
		let cancelled = false;
		const loadEvents = async () => {
			try {
				const rows = await eventsClient.listEvents(0, EVENTS_LIMIT);
				if (!cancelled) {
					streamEventsLoaded(rows.map(toStreamEvent));
				}
			} catch (error) {
				console.warn("[StateStream] Failed to load events", error);
			}
		};

		void loadEvents();
		const interval = window.setInterval(() => {
			void loadEvents();
		}, EVENTS_REFRESH_MS);

		return () => {
			cancelled = true;
			window.clearInterval(interval);
		};
	}, []);

	return (
		<main className="flex h-full min-h-0 flex-col gap-3 bg-background p-4 text-foreground">
			<header className="flex shrink-0 items-start justify-between gap-4">
				<div className="space-y-1">
					<h1 className="text-xl font-semibold tracking-tight">State stream</h1>
					<p className="text-sm text-muted-foreground">
						Live business events and current dashboard indicators.
					</p>
				</div>
				<span className="shrink-0 text-xs tabular-nums text-muted-foreground">
					{events.length} events
				</span>
			</header>

			<div
				className="grid min-h-0 flex-1 gap-3"
				style={{
					gridTemplateColumns: "minmax(300px, 360px) minmax(0, 1fr)",
				}}
			>
				<Card
					className="min-h-0 rounded-none border-0 bg-transparent py-0 shadow-none"
					aria-label="Events"
				>
					<CardHeader className="border-b px-3 py-3">
						<CardTitle className="text-base">Events</CardTitle>
						<CardDescription>Latest first</CardDescription>
					</CardHeader>
					<CardContent className="p-0">
						<ScrollArea className="h-full">
							{events.length === 0 ? (
								<EmptyEvents />
							) : (
								<div className="grid gap-2 p-3">
									{events.map((item) => (
										<StreamEventRow item={item} key={item.id} />
									))}
								</div>
							)}
						</ScrollArea>
					</CardContent>
				</Card>

				<Card
					className="min-h-0 rounded-none border-0 bg-transparent py-0 shadow-none"
					aria-label="Current indicators"
				>
					<CardHeader className="border-b px-3 py-3">
						<CardTitle className="text-base">Indicators</CardTitle>
						<CardDescription>Current state</CardDescription>
						<CardAction>
							<Gauge
								aria-hidden="true"
								className="text-muted-foreground"
								size={18}
							/>
						</CardAction>
					</CardHeader>

					<CardContent className="p-0">
						<ScrollArea className="h-full">
							{indicators.length === 0 ? (
								<EmptySignals />
							) : (
								<div className="grid auto-rows-[minmax(10rem,1fr)] grid-cols-2 gap-3 p-4 [grid-auto-flow:dense] sm:grid-cols-3 xl:grid-cols-4">
									{indicators.map((indicator) => (
										<div
											key={indicator.widgetId}
											className={`min-h-0 ${
												indicator.size === "lg"
													? "col-span-2 row-span-2"
													: ""
											}`}
										>
											{indicator.component}
										</div>
									))}
								</div>
							)}
						</ScrollArea>
					</CardContent>
				</Card>
			</div>
		</main>
	);
}
