import {
	createPushRouterServiceClient,
	type PushMessage,
} from "g-pushrouter/browser";
import type { RightPanelEvent, RightPanelEventLevel } from "sidebar-controller";
// The value import stays on the deep path: the package root pulls in the DOM
// controller, which this module has no use for.
import {
	rightPanelEventRecorded,
	rightPanelEventsCleared,
	rightPanelEventsHydrated,
} from "sidebar-controller/store";
import {
	$signalStatus,
	createFrontNrpcClientConfig,
	type SignalEvent,
	signalChannel,
} from "signal-channel";
import { authToken } from "../auth-token";

/**
 * Feeds the right panel's Events tab from `pushrouter`.
 *
 * Two sources, one feed. Live messages arrive over the signal channel as they
 * are published; `history()` replays the ones that were published while this
 * browser was not connected — a reload, a second tab, a login a minute after
 * the order landed. Both go through the same store, which deduplicates by id,
 * so a message present in both is shown once.
 */

const LEVELS: readonly RightPanelEventLevel[] = [
	"info",
	"success",
	"warning",
	"error",
];

let started = false;
let stopChannel: (() => void) | undefined;
let stopStatus: (() => void) | undefined;
let stopAuth: (() => void) | undefined;
/** Subject the current feed belongs to, so a session change can empty it. */
let feedSubject: string | null = null;

/**
 * A push frame and a replayed message are the same object by construction —
 * `pushrouter` encodes one shape for both — so one narrowing covers the socket
 * and the history reply. Anything without an id and a name is some other
 * signal (a call offer, a dictation chunk) and is not a notification.
 */
function toPanelEvent(value: unknown): RightPanelEvent | null {
	if (typeof value !== "object" || value === null) return null;
	const candidate = value as Partial<PushMessage> & { type?: string };
	if (candidate.type !== "push") return null;
	if (typeof candidate.id !== "string" || typeof candidate.name !== "string") {
		return null;
	}
	const level = LEVELS.find((known) => known === candidate.level) ?? "info";
	return {
		id: candidate.id,
		name: candidate.name,
		level,
		at: typeof candidate.at === "number" ? candidate.at : Date.now(),
		titleKey: candidate.titleKey,
		title: candidate.title,
		bodyKey: candidate.bodyKey,
		body: candidate.body,
		params: candidate.params,
		link: candidate.link,
	};
}

function onSignal(event: SignalEvent): void {
	const notification = toPanelEvent(event);
	if (notification) rightPanelEventRecorded(notification);
}

async function hydrate(): Promise<void> {
	const subject = authToken.payload()?.sub ?? null;
	// Logging out and back in on the same page must not leave the previous
	// account's notifications on screen: they were addressed at somebody else.
	if (subject !== feedSubject) {
		rightPanelEventsCleared();
		feedSubject = subject;
	}
	// The panel is a per-user feed and the service refuses an anonymous caller;
	// asking anyway would only produce a rejected request per reconnect.
	if (!authToken.isAuthenticated()) return;
	try {
		const client = createPushRouterServiceClient(
			createFrontNrpcClientConfig({ target: "fujin" }),
		);
		const replay = await client.history();
		const events = (replay?.messages ?? [])
			.map((message) => toPanelEvent({ type: "push", ...message }))
			.filter((event): event is RightPanelEvent => event !== null);
		if (events.length > 0) rightPanelEventsHydrated(events);
	} catch (error) {
		// A missing replay is not worth breaking the shell over: live messages
		// keep arriving, and the next reconnect tries again.
		console.warn("[notifications] replay unavailable", error);
	}
}

/**
 * Idempotent: the shell mounts once, but bundles that evaluate independently
 * (the embeddable widget, a surface) must not each attach their own listener to
 * the shared socket.
 */
export function startNotifications(): () => void {
	if (started) return stopNotifications;
	started = true;

	stopChannel = signalChannel.subscribeAll(onSignal);
	// Every reconnect replays, because that is exactly the window in which
	// messages were published with nowhere to deliver them. `watch` fires with
	// the current status too, so an already-open socket hydrates immediately.
	stopStatus = $signalStatus.watch((status) => {
		if (status === "connected") void hydrate();
	});
	// A logout does not necessarily close the socket, so waiting for a
	// reconnect would leave the previous account's feed on screen.
	if (typeof window !== "undefined") {
		const onAuthChange = () => void hydrate();
		window.addEventListener("auth-token-changed", onAuthChange);
		stopAuth = () =>
			window.removeEventListener("auth-token-changed", onAuthChange);
	}
	return stopNotifications;
}

export function stopNotifications(): void {
	stopChannel?.();
	stopStatus?.();
	stopAuth?.();
	stopChannel = undefined;
	stopStatus = undefined;
	stopAuth = undefined;
	feedSubject = null;
	started = false;
}

export { toPanelEvent as __testPanelEvent };
