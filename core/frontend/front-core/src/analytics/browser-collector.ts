import { authToken } from "../auth-token";
import { createAnalyticsTransport } from "./transport";

type BrowserEvent = {
	ts: number;
	visitor_id: string;
	session_id: string;
	event_type: string;
	company_id: string;
	campaign_id: string;
	url: string;
	referrer: string;
	language: string;
	timezone: string;
	user_agent: string;
	screen: string;
	viewport: string;
	pixel_ratio: number;
	touch_points: number;
	hardware_concurrency: number;
	device_memory: number;
	webdriver: boolean;
	visible_ms: number;
	hidden_ms: number;
	pointer_events: number;
	pointer_distance: number;
	pointer_directions: number;
	scroll_events: number;
	scroll_max: number;
	trusted_clicks: number;
	untrusted_clicks: number;
	key_events: number;
	user_activation: boolean;
	first_interaction_ms: number;
	audience_type: "authenticated" | "external";
	content_type: string;
	content_id: string;
};

type ActivityMetrics = Partial<
	Pick<
		BrowserEvent,
		| "visible_ms"
		| "hidden_ms"
		| "pointer_events"
		| "pointer_distance"
		| "pointer_directions"
		| "scroll_events"
		| "trusted_clicks"
		| "untrusted_clicks"
		| "key_events"
		| "content_type"
		| "content_id"
	>
>;

const HEARTBEAT_INTERVAL_MS = 15_000;
const POINTER_SAMPLE_INTERVAL_MS = 250;
const SCROLL_SAMPLE_INTERVAL_MS = 500;
const VISITOR_KEY = "rp-analytics:visitor";
const SESSION_KEY = "rp-analytics:session";

function isAuthenticatedAudience(): boolean {
	try {
		return authToken.isAuthenticated();
	} catch {
		return false;
	}
}

function id(storage: Storage | undefined, key: string): string {
	try {
		const existing = storage?.getItem(key);
		if (existing) return existing;
	} catch {
		// Storage can be disabled by browser privacy settings.
	}
	const value =
		globalThis.crypto?.randomUUID?.() ??
		`${Date.now()}-${Math.random().toString(36).slice(2)}`;
	try {
		storage?.setItem(key, value);
	} catch {
		// Keep this visit usable when storage is unavailable.
	}
	return value;
}

function browserStorage(
	name: "localStorage" | "sessionStorage",
): Storage | undefined {
	try {
		return window[name];
	} catch {
		return undefined;
	}
}

function maxScroll(): number {
	const height = Math.max(
		document.documentElement.scrollHeight,
		document.body?.scrollHeight ?? 0,
	);
	const available = height - window.innerHeight;
	return available <= 0
		? 1
		: Math.min(1, Math.max(0, window.scrollY / available));
}

function clickTarget(
	target: EventTarget | null,
): Pick<ActivityMetrics, "content_type" | "content_id"> {
	if (!(target instanceof Element)) return {};
	const interactive = target.closest<HTMLElement>(
		'a[href], button, [role="button"], input[type="button"], input[type="submit"], [data-analytics-id]',
	);
	const element = interactive ?? target;
	const tag = element.tagName.toLowerCase();
	const contentType =
		tag === "a" ? "link" : (element.getAttribute("role") ?? tag);
	const href =
		element instanceof HTMLAnchorElement
			? element.getAttribute("href")
			: undefined;
	const label =
		element.getAttribute("aria-label") ||
		element.getAttribute("title") ||
		(element.matches("a, button, [role='button']")
			? element.textContent?.replace(/\s+/g, " ").trim().slice(0, 80)
			: "");
	const stableId =
		element.getAttribute("data-analytics-id") || element.id || "";
	const path: string[] = [];
	let current: HTMLElement | null = element;
	while (current && path.length < 3) {
		const id = current.id ? `#${current.id}` : "";
		const classes = [...current.classList]
			.slice(0, 2)
			.map((name) => `.${name}`)
			.join("");
		path.unshift(`${current.tagName.toLowerCase()}${id}${classes}`);
		current = current.parentElement;
	}
	const description = [label, href, stableId]
		.filter((part): part is string => Boolean(part))
		.join(" · ");
	return {
		content_type: contentType,
		content_id: description || path.join(" > "),
	};
}

export function startBrowserAnalytics(): void {
	if (typeof window === "undefined" || typeof document === "undefined") return;

	const transport = createAnalyticsTransport();
	const visitorId = id(browserStorage("localStorage"), VISITOR_KEY);
	const sessionId = id(browserStorage("sessionStorage"), SESSION_KEY);
	let authenticatedAudience = isAuthenticatedAudience();
	const updateAudience = () => {
		authenticatedAudience = isAuthenticatedAudience();
	};
	window.addEventListener("auth-token-changed", updateAudience);
	window.addEventListener("storage", updateAudience);
	const startedAt = Date.now();
	const query = new URLSearchParams(window.location.search);
	const companyId = query.get("company_id") ?? query.get("company") ?? "";
	const campaignId =
		query.get("campaign_id") ??
		query.get("campaign") ??
		query.get("utm_campaign") ??
		"";
	const identity = {
		visitor_id: visitorId,
		session_id: sessionId,
		company_id: companyId,
		campaign_id: campaignId,
	};
	let firstInteractionMs = 0;
	let lastHeartbeatAt = startedAt;
	let lastVisibility = document.visibilityState;
	let deepestScroll = maxScroll();
	let lastPointerAt = 0;
	let lastPointer: { x: number; y: number; dx: number; dy: number } | undefined;
	let lastScrollAt = 0;
	let lastPageUrl = "";
	let closed = false;

	function event(
		eventType: string,
		metrics: ActivityMetrics = {},
	): BrowserEvent {
		const nav = navigator as Navigator & {
			deviceMemory?: number;
			userActivation?: { hasBeenActive: boolean };
		};
		return {
			ts: Date.now(),
			...identity,
			event_type: eventType,
			url: `${window.location.pathname}${window.location.search}${window.location.hash}`,
			referrer: document.referrer,
			language: navigator.language ?? "",
			timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
			user_agent: navigator.userAgent,
			screen: `${screen.width}x${screen.height}`,
			viewport: `${window.innerWidth}x${window.innerHeight}`,
			pixel_ratio: window.devicePixelRatio || 1,
			touch_points: navigator.maxTouchPoints || 0,
			hardware_concurrency: navigator.hardwareConcurrency || 0,
			device_memory: nav.deviceMemory ?? 0,
			webdriver: navigator.webdriver,
			visible_ms: metrics.visible_ms ?? 0,
			hidden_ms: metrics.hidden_ms ?? 0,
			pointer_events: metrics.pointer_events ?? 0,
			pointer_distance: metrics.pointer_distance ?? 0,
			pointer_directions: metrics.pointer_directions ?? 0,
			scroll_events: metrics.scroll_events ?? 0,
			scroll_max: deepestScroll,
			trusted_clicks: metrics.trusted_clicks ?? 0,
			untrusted_clicks: metrics.untrusted_clicks ?? 0,
			key_events: metrics.key_events ?? 0,
			user_activation: nav.userActivation?.hasBeenActive ?? false,
			first_interaction_ms: firstInteractionMs,
			audience_type: authenticatedAudience ? "authenticated" : "external",
			content_type: metrics.content_type ?? "",
			content_id: metrics.content_id ?? "",
		};
	}

	function send(eventType: string, metrics: ActivityMetrics = {}): void {
		if (
			closed ||
			/^\/(?:en\/|ru\/|de\/|fr\/|es\/|it\/|pt\/)?console(?:\/|$)/.test(
				window.location.pathname,
			)
		)
			return;
		transport.send(event(eventType, metrics));
	}

	window.addEventListener("front-core:analytics-event", (event) => {
		const detail = (
			event as CustomEvent<{
				event_type: string;
				content_id: string;
				content_type: string;
				visible_ms?: number;
			}>
		).detail;
		if (!detail) return;
		send(detail.event_type, {
			content_id: detail.content_id,
			content_type: detail.content_type,
			visible_ms: detail.visible_ms,
		});
	});

	function markInteraction(): void {
		if (firstInteractionMs === 0) firstInteractionMs = Date.now() - startedAt;
	}

	function pageView(): void {
		const url = `${window.location.pathname}${window.location.search}${window.location.hash}`;
		if (url === lastPageUrl) return;
		lastPageUrl = url;
		send("page_view");
	}

	pageView();

	window.addEventListener(
		"pointermove",
		(pointerEvent) => {
			if (!pointerEvent.isTrusted) return;
			markInteraction();
			const now = Date.now();
			if (now - lastPointerAt < POINTER_SAMPLE_INTERVAL_MS) return;
			lastPointerAt = now;
			let distance = 0;
			let directions = 0;
			if (lastPointer) {
				const dx = pointerEvent.clientX - lastPointer.x;
				const dy = pointerEvent.clientY - lastPointer.y;
				distance = Math.round(Math.hypot(dx, dy));
				if (
					(Math.sign(dx) !== lastPointer.dx ||
						Math.sign(dy) !== lastPointer.dy) &&
					(dx || dy)
				)
					directions = 1;
				lastPointer.dx = Math.sign(dx);
				lastPointer.dy = Math.sign(dy);
				lastPointer.x = pointerEvent.clientX;
				lastPointer.y = pointerEvent.clientY;
			} else {
				lastPointer = {
					x: pointerEvent.clientX,
					y: pointerEvent.clientY,
					dx: 0,
					dy: 0,
				};
			}
			send("pointer", {
				pointer_events: 1,
				pointer_distance: distance,
				pointer_directions: directions,
			});
		},
		{ passive: true },
	);
	window.addEventListener(
		"click",
		(clickEvent) => {
			if (clickEvent.isTrusted) markInteraction();
			send("click", {
				...clickTarget(clickEvent.target),
				...(clickEvent.isTrusted
					? { trusted_clicks: 1 }
					: { untrusted_clicks: 1 }),
			});
		},
		true,
	);
	window.addEventListener(
		"keydown",
		(keyEvent) => {
			if (!keyEvent.isTrusted) return;
			markInteraction();
			send("key", { key_events: 1 });
		},
		true,
	);
	window.addEventListener(
		"scroll",
		(scrollEvent) => {
			if (!scrollEvent.isTrusted) return;
			const now = Date.now();
			deepestScroll = Math.max(deepestScroll, maxScroll());
			if (now - lastScrollAt < SCROLL_SAMPLE_INTERVAL_MS) return;
			lastScrollAt = now;
			markInteraction();
			send("scroll", { scroll_events: 1 });
		},
		{ passive: true },
	);
	function activityMetrics(): ActivityMetrics {
		const now = Date.now();
		const elapsed = now - lastHeartbeatAt;
		lastHeartbeatAt = now;
		const metrics = {
			visible_ms: lastVisibility === "visible" ? elapsed : 0,
			hidden_ms: lastVisibility === "hidden" ? elapsed : 0,
		};
		lastVisibility = document.visibilityState;
		return metrics;
	}

	document.addEventListener("visibilitychange", () => {
		send("visibility", activityMetrics());
		if (document.visibilityState === "hidden") transport.flush(true);
	});

	window.addEventListener("popstate", pageView);
	for (const method of ["pushState", "replaceState"] as const) {
		history[method] = new Proxy(history[method], {
			apply(target, thisArg, args) {
				const result = Reflect.apply(target, thisArg, args);
				pageView();
				return result;
			},
		});
	}

	let heartbeat: number;
	function startHeartbeat(): void {
		heartbeat = window.setInterval(() => {
			send("activity", activityMetrics());
		}, HEARTBEAT_INTERVAL_MS);
	}
	startHeartbeat();

	window.addEventListener("pagehide", () => {
		window.dispatchEvent(new Event("front-core:analytics-before-exit"));
		send("page_exit", activityMetrics());
		closed = true;
		window.clearInterval(heartbeat);
		transport.pause();
	});
	window.addEventListener("pageshow", (pageEvent) => {
		if (!pageEvent.persisted) return;
		closed = false;
		lastHeartbeatAt = Date.now();
		lastVisibility = document.visibilityState;
		lastPageUrl = "";
		transport.resume();
		pageView();
		startHeartbeat();
	});
	window.addEventListener("online", () => transport.flush());
}
