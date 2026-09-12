import { beforeEach, describe, expect, it } from "bun:test";
import { InMemoryMigrationState, SqlStore } from "back-core";
import { runWithWorkspaceContext } from "nrpc";
import eventsMigrations from "./stores/events/migrations";
import { EventsStoreService } from "./stores/events/service";

/**
 * The feed is the business's own, so an authenticated caller sees it whole.
 * What the tags buy here is that an event stops being readable by anyone who
 * can reach the port, and that a per-team feed is a grant rather than a schema
 * change.
 */
describe("who sees which events", () => {
	let store: SqlStore;
	let events: EventsStoreService;

	const as = <T>(user: string, fn: () => T, tags?: string[]) =>
		runWithWorkspaceContext({ user, accessTags: tags }, fn);

	beforeEach(async () => {
		store = new SqlStore(
			":memory:",
			eventsMigrations,
			new InMemoryMigrationState(),
		);
		await store.open();
		await store.migrate();
		events = new EventsStoreService(store);
	});

	const publish = (publisher: string, type: string, entityId: string) =>
		as(publisher, () =>
			events.publish({ type, service: "requests", entityId }),
		);

	it("shows the feed to any authenticated caller", async () => {
		await publish("rp-requests", "request.created", "request-1");
		await publish("rp-orders", "order.queued", "order-1");

		const feed = await as("alice", () => events.listEvents(0, 10));
		expect(feed.map((event) => event.entityId).sort()).toEqual([
			"order-1",
			"request-1",
		]);
	});

	it("shows nothing to a caller with no token", async () => {
		await publish("rp-requests", "request.created", "request-1");

		expect(await events.listEvents(0, 10)).toHaveLength(0);
	});

	it("keeps a narrowed event to the team it was opened to", async () => {
		const open = await publish("rp-requests", "request.created", "request-1");
		const narrowed = await publish("rp-finance", "payment.taken", "payment-1");
		await events.access.setVisibility(narrowed, "private");
		await events.access.grant(narrowed, "team-finance");

		expect(
			(await as("alice", () => events.listEvents(0, 10))).map((e) => e.id),
		).toEqual([open]);
		expect(
			(await as("clerk", () => events.listEvents(0, 10), ["team-finance"])).map(
				(e) => e.id,
			),
		).toContain(narrowed);
	});

	it("does not take an audience from the publisher's payload", async () => {
		const id = await publish("rp-requests", "request.created", "request-1");

		expect((await events.access.tagsOf(id)).sort()).toEqual([
			"authenticated",
			"u-rp-requests",
		]);
	});
});
