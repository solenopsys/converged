import { beforeEach, describe, expect, it } from "bun:test";
import { InMemoryMigrationState, SqlStore } from "back-core";
import { runWithWorkspaceContext } from "nrpc";
import pinsMigrations from "./stores/pins/migrations";
import { DashboardPinsStoreService } from "./stores/pins/service";

/**
 * A dashboard is one person's. The table did not know that: `widgetId` was the
 * identity of a pin, so two people who pinned the same indicator shared a row
 * and either could take it off the other's screen.
 */
describe("whose dashboard a pin is on", () => {
	let store: SqlStore;
	let pins: DashboardPinsStoreService;

	const as = <T>(user: string, fn: () => T, tags?: string[]) =>
		runWithWorkspaceContext({ user, accessTags: tags }, fn);

	beforeEach(async () => {
		store = new SqlStore(
			":memory:",
			pinsMigrations,
			new InMemoryMigrationState(),
		);
		await store.open();
		await store.migrate();
		pins = new DashboardPinsStoreService(store);
	});

	it("keeps one person's pins off another's dashboard", async () => {
		await as("alice", () =>
			pins.pin({ widgetId: "orders.requests", title: "Requests" }),
		);

		expect(await as("bob", () => pins.list())).toEqual([]);
		expect(
			(await as("alice", () => pins.list())).map((p) => p.widgetId),
		).toEqual(["orders.requests"]);
	});

	it("lets two people pin the same indicator without sharing a row", async () => {
		const mine = await as("alice", () =>
			pins.pin({ widgetId: "dag.daily-errors", title: "Mine" }),
		);
		const theirs = await as("bob", () =>
			pins.pin({ widgetId: "dag.daily-errors", title: "Theirs" }),
		);

		expect(mine.id).not.toBe(theirs.id);
		expect((await as("alice", () => pins.list()))[0].title).toBe("Mine");
		expect((await as("bob", () => pins.list()))[0].title).toBe("Theirs");
	});

	it("does not let one person unpin another's widget", async () => {
		await as("alice", () => pins.pin({ widgetId: "orders.requests" }));

		await as("bob", () => pins.unpin("orders.requests"));

		expect(await as("alice", () => pins.list())).toHaveLength(1);
	});

	it("clears only the caller's own dashboard", async () => {
		await as("alice", () => pins.pin({ widgetId: "orders.requests" }));
		await as("bob", () => pins.pin({ widgetId: "dag.daily-errors" }));

		await as("alice", () => pins.clear());

		expect(await as("alice", () => pins.list())).toEqual([]);
		expect(await as("bob", () => pins.list())).toHaveLength(1);
	});

	it("shares a pin onto a team's screens through a group tag", async () => {
		const shared = await as("alice", () =>
			pins.pin({ widgetId: "orders.load", title: "Shop load" }),
		);
		await pins.access.grant(shared.id, "team-production");

		expect(
			(await as("bob", () => pins.list(), ["team-production"])).map(
				(p) => p.id,
			),
		).toEqual([shared.id]);
		// A group tag is an identity tag, so the team may also rearrange it.
		expect(
			await as(
				"bob",
				() => pins.pin({ widgetId: "orders.load", position: 3 }),
				["team-production"],
			),
		).toMatchObject({ id: shared.id, position: 3 });
	});

	it("shows nothing to a caller with no token", async () => {
		await as("alice", () => pins.pin({ widgetId: "orders.requests" }));

		expect(await pins.list()).toEqual([]);
	});
});
