import {
	Activity,
	Clock,
	FileText,
	Globe,
	Hand,
	LogOut,
	ScreenPreview,
} from "front-core";
import type { DomainRef } from "front-core/object-runtime";
import type { ComponentChildren } from "preact";
import type { AnalyticsEvent } from "g-analytics";
import { useEffect, useState } from "preact/hooks";
import analytics from "../service";

type SessionData = Record<string, unknown>;

export function AnalyticsSessionEventsView({
	reference,
}: {
	reference: DomainRef;
}) {
	const [events, setEvents] = useState<AnalyticsEvent[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string>();
	const [visitorId, sessionId] =
		reference.kind === "object" ? reference.id.split(":", 2) : ["", ""];
	const session =
		reference.kind === "object"
			? (reference.data as SessionData | undefined)
			: undefined;

	useEffect(() => {
		let active = true;
		setLoading(true);
		setError(undefined);
		const load = async () => {
			try {
				const identity = { visitor_id: visitorId, session_id: sessionId };
				const [hot, cold] = await Promise.all([
					loadEventPages((query) => analytics.listHot(query), identity),
					loadEventPages((query) => analytics.listCold(query), identity),
				]);
				if (active)
					setEvents(
						[...cold, ...hot].sort((left, right) => left.ts - right.ts),
					);
			} catch (cause) {
				if (active)
					setError(cause instanceof Error ? cause.message : String(cause));
			} finally {
				if (active) setLoading(false);
			}
		};
		if (visitorId && sessionId) void load();
		else {
			setError("Session identity is missing.");
			setLoading(false);
		}
		return () => {
			active = false;
		};
	}, [visitorId, sessionId]);

	const firstEvent = events[0];
	const lastEvent = events.at(-1);
	const startedAt = timestamp(session?.first_seen) ?? firstEvent?.ts;
	const sessionDuration = durationSeconds(session, firstEvent, lastEvent);
	const screen = stringValue(session?.screen) ?? firstEvent?.screen;
	const viewport = firstEvent?.viewport;
	const userAgent = stringValue(session?.user_agent) ?? firstEvent?.user_agent;
	const browser = describeBrowser(userAgent);
	const metadata = [
		["IP", stringValue(session?.ip_address)],
		[
			"Location",
			[session?.city_name, session?.country_name].filter(Boolean).join(", "),
		],
		["Device", stringValue(session?.device_type)],
		["Browser", browser],
		["Source", stringValue(session?.utm_source)],
		["Medium", stringValue(session?.utm_medium)],
		["Campaign", stringValue(session?.utm_campaign)],
		["Term", stringValue(session?.utm_term)],
		["Content", stringValue(session?.utm_content)],
		["Campaign ID", stringValue(session?.utm_id)],
		["Source platform", stringValue(session?.utm_source_platform)],
		["Creative format", stringValue(session?.utm_creative_format)],
		["Marketing tactic", stringValue(session?.utm_marketing_tactic)],
	].filter((item): item is [string, string] => Boolean(item[1]));

	return (
		<div class="flex h-full min-h-0 flex-col">
			<header class="border-b border-border p-4">
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div class="min-w-0">
						<h1 class="text-lg font-semibold">Session timeline</h1>
						<p class="text-sm text-muted-foreground">{sessionId}</p>
					</div>
					<div class="flex flex-wrap gap-2 text-sm">
						{startedAt !== undefined && (
							<MetaChip icon={<Clock size={14} />}>
								Started {new Date(startedAt).toLocaleString()}
							</MetaChip>
						)}
						<MetaChip icon={<Activity size={14} />}>
							{events.length} events
						</MetaChip>
						{sessionDuration !== undefined && (
							<MetaChip icon={<Clock size={14} />}>
								{formatOffset(sessionDuration)} s
							</MetaChip>
						)}
					</div>
					<div class="ml-3 flex items-start gap-3">
						{screen && <ScreenPreview resolution={screen} label="Display" />}
						{viewport && (
							<ScreenPreview resolution={viewport} label="Viewport" />
						)}
					</div>
				</div>
				{metadata.length > 0 && (
					<div class="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
						{metadata.map(([label, value]) => (
							<div key={label} class="flex gap-1.5">
								<span class="text-muted-foreground">{label}</span>
								<span>{value}</span>
							</div>
						))}
					</div>
				)}
			</header>
			<div class="min-h-0 flex-1 overflow-auto p-4">
				{loading ? (
					<p class="text-sm text-muted-foreground">Loading events…</p>
				) : error ? (
					<p class="text-sm text-destructive">{error}</p>
				) : events.length === 0 ? (
					<p class="text-sm text-muted-foreground">
						No events in this session.
					</p>
				) : (
					<ol class="max-w-5xl">
						{events.map((event, index) => {
							const offset = Math.max(
								0,
								(event.ts - (startedAt ?? event.ts)) / 1000,
							);
							const Icon = eventIcon(event.event_type);
							return (
								<li
									key={`${event.ts}:${event.event_type}:${index}`}
									class="relative flex min-h-16 gap-3"
								>
									<div class="relative flex w-8 shrink-0 justify-center">
										{index < events.length - 1 && (
											<span class="absolute bottom-0 top-8 w-px bg-border" />
										)}
										<span class="relative z-10 flex size-8 items-center justify-center rounded-full border border-border bg-background text-muted-foreground">
											<Icon size={15} />
										</span>
									</div>
									<div class="flex min-w-0 flex-1 items-start justify-between gap-4 border-b border-border/70 pb-3 pt-1">
										<div class="min-w-0">
											<div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
												<span class="font-medium">
													{formatEventName(event.event_type)}
												</span>
												<span class="text-xs text-muted-foreground">
													{new Date(event.ts).toLocaleTimeString()}
												</span>
											</div>
											{event.url && (
												<p
													class="mt-1 truncate text-sm text-muted-foreground"
													title={event.url}
												>
													{event.url}
												</p>
											)}
											{eventDetails(event) && (
												<p class="mt-1 text-sm text-muted-foreground">
													{eventDetails(event)}
												</p>
											)}
										</div>
										<span class="shrink-0 whitespace-nowrap font-mono text-sm text-muted-foreground">
											+{formatOffset(offset)} s
										</span>
									</div>
								</li>
							);
						})}
					</ol>
				)}
			</div>
		</div>
	);
}

function MetaChip({
	icon,
	children,
}: {
	icon: ComponentChildren;
	children: ComponentChildren;
}) {
	return (
		<span class="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-muted-foreground">
			{icon}
			{children}
		</span>
	);
}

function eventIcon(eventType: string) {
	if (eventType === "page_view") return Globe;
	if (eventType === "page_exit") return LogOut;
	if (eventType === "click" || eventType === "content_click") return Hand;
	if (eventType.startsWith("page_")) return FileText;
	return Activity;
}

function formatEventName(value: string) {
	return value.replaceAll("_", " ");
}

function eventDetails(event: AnalyticsEvent) {
	const details: string[] = [];
	if (event.content_type || event.content_id)
		details.push(
			[event.content_type, event.content_id].filter(Boolean).join(": "),
		);
	if (event.trusted_clicks) details.push(`clicks ${event.trusted_clicks}`);
	if (event.visible_ms) details.push(`visible ${event.visible_ms} ms`);
	return details.join(" · ");
}

function formatOffset(seconds: number) {
	return Number.isInteger(seconds) ? String(seconds) : seconds.toFixed(1);
}

function durationSeconds(
	session: SessionData | undefined,
	firstEvent: AnalyticsEvent | undefined,
	lastEvent: AnalyticsEvent | undefined,
) {
	const storedDuration = session?.duration_seconds;
	if (typeof storedDuration === "number" && Number.isFinite(storedDuration))
		return Math.max(0, storedDuration);
	const first = timestamp(session?.first_seen) ?? firstEvent?.ts;
	const last = timestamp(session?.last_seen) ?? lastEvent?.ts;
	return first !== undefined && last !== undefined
		? Math.max(0, (last - first) / 1000)
		: undefined;
}

function timestamp(value: unknown): number | undefined {
	if (typeof value === "number") return value;
	if (typeof value === "string") {
		const parsed = Date.parse(value);
		return Number.isNaN(parsed) ? undefined : parsed;
	}
	return undefined;
}

function stringValue(value: unknown): string | undefined {
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

function describeBrowser(userAgent?: string) {
	if (!userAgent) return undefined;
	const browser =
		(userAgent.match(/Edg\/([\d.]+)/) &&
			`Edge ${userAgent.match(/Edg\/([\d.]+)/)?.[1]}`) ||
		(userAgent.match(/OPR\/([\d.]+)/) &&
			`Opera ${userAgent.match(/OPR\/([\d.]+)/)?.[1]}`) ||
		(userAgent.match(/Chrome\/([\d.]+)/) &&
			`Chrome ${userAgent.match(/Chrome\/([\d.]+)/)?.[1]}`) ||
		(userAgent.match(/Firefox\/([\d.]+)/) &&
			`Firefox ${userAgent.match(/Firefox\/([\d.]+)/)?.[1]}`) ||
		(userAgent.match(/Version\/([\d.]+).*Safari/) &&
			`Safari ${userAgent.match(/Version\/([\d.]+).*Safari/)?.[1]}`) ||
		"Browser unknown";
	const os = /Windows/i.test(userAgent)
		? "Windows"
		: /Android/i.test(userAgent)
			? "Android"
			: /iPhone|iPad|iPod/i.test(userAgent)
				? "iOS"
				: /Mac OS X/i.test(userAgent)
					? "macOS"
					: /Linux/i.test(userAgent)
						? "Linux"
						: undefined;
	return os ? `${browser} · ${os}` : browser;
}

async function loadEventPages(
	load: (params: {
		visitor_id: string;
		session_id: string;
		limit: number;
		offset: number;
	}) => Promise<{ items: unknown[]; totalCount?: number }>,
	identity: { visitor_id: string; session_id: string },
): Promise<AnalyticsEvent[]> {
	const all: AnalyticsEvent[] = [];
	let offset = 0;
	let totalCount = Number.POSITIVE_INFINITY;
	while (offset < totalCount) {
		const page = await load({ ...identity, limit: 200, offset });
		all.push(...(page.items as AnalyticsEvent[]));
		totalCount = page.totalCount ?? offset + page.items.length;
		if (page.items.length < 200) break;
		offset += page.items.length;
	}
	return all;
}
