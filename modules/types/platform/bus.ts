/**
 * The business event bus: the fourth of Fujin's message streams.
 *
 * A business event is a fact that happened — an order was paid, a webhook
 * arrived, a schedule elapsed. Unlike a notification it is not addressed at
 * anyone: subscribers state which topics they care about and Fujin hands each
 * event to whoever currently matches. Delivery is live and at-most-once; what
 * must survive a restart is read back from the journal with `replay`.
 *
 * Topics are dot-separated and carry the entity: `order.updated.42`. A pattern
 * matches segment by segment, where `*` stands for exactly one segment and `>`
 * for the remaining tail — the NATS convention, so `order.*.42` follows one
 * order and `order.>` follows all of them.
 *
 * Subscriptions belong to the connection that made them and disappear with it.
 * There is deliberately no durable subscriber registry here: "which of a
 * million users watches order 42" is application data, not routing state.
 *
 * @nrpcTarget fujin
 */

export type EventSource = "webhook" | "cron" | "service" | "ui";

export type BusEventInput = {
	/** Topic. Dot-separated, entity id included: `order.updated.42`. */
	name: string;
	/** Tenant. Service callers may name another one; user callers cannot. */
	scope?: string;
	source?: EventSource;
	/** Subject that caused the event, when a person did. */
	actor?: string;
	correlationId?: string;
	/**
	 * Idempotency key. Travels with the event so a consumer can drop a repeat
	 * on its own — the property that keeps a future clustered Fujin honest.
	 */
	dedupKey?: string;
	payload?: unknown;
};

export type BusEvent = {
	id: string;
	name: string;
	scope: string;
	source: EventSource;
	at: number;
	actor?: string;
	correlationId?: string;
	dedupKey?: string;
	payload?: unknown;
};

export type PublishResult = {
	id: string;
	/** Runtime peers the event was handed to. */
	peers: number;
	/** Live browser sessions that matched. */
	sessions: number;
};

export type SubscribeResult = {
	/** Patterns this connection holds after the call. */
	patterns: string[];
};

export type ReplayParams = {
	/** Exclusive lower bound, an event id from an earlier delivery. */
	since?: string;
	/** Topic patterns; empty means everything the scope allows. */
	patterns?: string[];
	limit?: number;
};

export type ReplayResult = {
	events: BusEvent[];
	/** Cursor to pass as `since` next time; empty when nothing came back. */
	cursor: string;
};

export type SubscriptionState = {
	/** `peer:<target>` or `session:<id>`. */
	owner: string;
	patterns: string[];
};

export interface BusService {
	/** Publishes one event. Callable from a browser, a service and the UI gateway. */
	publish(event: BusEventInput): Promise<PublishResult>;
	/** Adds topic patterns to the calling connection. */
	subscribe(patterns: string[]): Promise<SubscribeResult>;
	/** Removes topic patterns from the calling connection. */
	unsubscribe(patterns: string[]): Promise<SubscribeResult>;
	/** Reads the journal forward from a cursor, for a consumer catching up. */
	replay(params: ReplayParams): Promise<ReplayResult>;
	/** Every live subscription, for the console. */
	subscriptions(): Promise<SubscriptionState[]>;
}
