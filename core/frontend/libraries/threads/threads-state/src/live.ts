import {
	createPushRouterServiceClient,
	type PushRouterServiceClient,
} from "g-pushrouter/browser";
import {
	$signalStatus,
	createFrontNrpcClientConfig,
	type SignalEvent,
	signalChannel,
} from "signal-channel";

/**
 * Live thread updates over Fujin's business channel.
 *
 * Fujin's third stream — `pushrouter` — is a service Fujin hosts rather than
 * routes to, because delivery is a property of the live WebSocket sessions it
 * already owns. Two of its properties are what make this work without a new
 * transport and without one repository calling another:
 *
 *   - `publish` is callable by a browser as well as by a service, and a user
 *     token may address any subject inside its own tenant;
 *   - the frame arrives on the same socket the NRPC clients already use, and
 *     `name` is dispatched by `signalChannel.subscribe`.
 *
 * The writer publishes, because the writer is the only party that knows the
 * audience: `rp-threads` deliberately does not know whose thread it holds, and
 * asking `rp-chats` would be a service-to-service call.
 *
 * What travels is a *signal*, never content. The receiver re-reads the thread
 * from `rp-threads`, where the visibility predicate applies. A forged push
 * therefore costs a neighbour one wasted fetch and reveals nothing — which is
 * exactly why the message body must not be put in `payload` and rendered.
 */

/** Push name. Flat on the frame, which is what the signal channel dispatches on. */
export const THREAD_MESSAGE_EVENT = "thread.message";

export type ThreadActivity = {
	threadId: string;
	/** Id of the message that caused this, for de-duplication by the receiver. */
	messageId?: string;
	/** What owns the thread, so a list view can decide whether it cares. */
	kind?: "chat" | "forum" | "comment" | "audio";
	/** The owning object, so an open list can refresh the right row. */
	ownerId?: string;
};

let client: PushRouterServiceClient | undefined;

function pushClient(): PushRouterServiceClient {
	client ??= createPushRouterServiceClient(
		createFrontNrpcClientConfig({ target: "fujin" }),
	);
	return client;
}

export type PublishThreadActivityOptions = ThreadActivity & {
	/**
	 * Who to wake up. A list of subjects for a thread with a membership — a
	 * chat room, a ticket — and `"scope"` for one without, where the readers
	 * are simply whoever has it open. A forum topic is the second case: there
	 * is no member list to address, and an unaddressed publish is what
	 * `pushrouter` provides for exactly that.
	 *
	 * Do not reach for `"scope"` to save a loop. It hands every tab in the
	 * tenant the existence of a thread, which for a private room is a leak even
	 * though the contents stay behind the read predicate.
	 */
	audience: readonly string[] | "scope";
	/** The author, skipped so the writer does not re-fetch its own write. */
	self?: string;
};

export async function publishThreadActivity({
	audience,
	self,
	...activity
}: PublishThreadActivityOptions): Promise<void> {
	const push = pushClient();
	const frame = { name: THREAD_MESSAGE_EVENT, level: "info" as const };
	// A push that reached no live session is not an error: the thread is the
	// durable record, and every reader re-reads it on reconnect anyway.
	const warn = (error: unknown) =>
		console.warn("[threads-state] push failed", error);

	if (audience === "scope") {
		// No `user`: `pushrouter` then delivers to every session in the caller's
		// own scope. A user token cannot name another scope, so this cannot
		// escape the tenant even if the payload asks it to.
		await push.publish({ ...frame, payload: activity }).catch(warn);
		return;
	}

	const recipients = [...new Set(audience)].filter(
		(user) => user && user !== self,
	);
	if (recipients.length === 0) return;
	await Promise.all(
		recipients.map((user) =>
			push.publish({ ...frame, user, payload: activity }).catch(warn),
		),
	);
}

function activityOf(event: SignalEvent): ThreadActivity | null {
	if (event.name !== THREAD_MESSAGE_EVENT) return null;
	const payload = event.payload;
	if (typeof payload !== "object" || payload === null) return null;
	const threadId = (payload as ThreadActivity).threadId;
	return typeof threadId === "string" && threadId.length > 0
		? (payload as ThreadActivity)
		: null;
}

export type WatchThreadOptions = {
	/** Thread to follow. Pass a getter when the open thread can change. */
	threadId: string | (() => string | undefined);
	/** Called on a matching push and on every reconnect. */
	onChange: (activity: ThreadActivity | null) => void;
};

/**
 * Follows one thread. Returns the detach function.
 *
 * Two sources, one callback. The push covers the normal case; the
 * `connected` transition covers the window in which messages were published
 * while this socket was down — the same reason `front-core/shell/notifications`
 * replays on every reconnect. There is no `pushrouter.history()` call here on
 * purpose: the thread itself is the durable record, so re-reading it is both
 * cheaper and truthful, where merging a bounded replay window into a rendered
 * feed is neither.
 */
export function watchThread({
	threadId,
	onChange,
}: WatchThreadOptions): () => void {
	const current = () =>
		typeof threadId === "function" ? threadId() : threadId;

	const stopChannel = signalChannel.subscribe(
		THREAD_MESSAGE_EVENT,
		(event: SignalEvent) => {
			const activity = activityOf(event);
			if (activity && activity.threadId === current()) onChange(activity);
		},
	);

	let connected = false;
	const status = $signalStatus.watch((value) => {
		const isConnected = value === "connected";
		// Only the transition matters: `watch` fires with the current value too,
		// and the caller has already loaded the thread by the time it subscribes.
		if (isConnected && !connected && current()) onChange(null);
		connected = isConnected;
	});

	return () => {
		stopChannel();
		status.unsubscribe();
	};
}

/** Test seam: lets a suite install a stub publisher. */
export function __setPushClient(
	next: PushRouterServiceClient | undefined,
): void {
	client = next;
}
