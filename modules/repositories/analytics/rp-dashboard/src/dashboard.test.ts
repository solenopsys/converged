import { beforeEach, describe, expect, it } from "bun:test";
import { InMemoryMigrationState, SqlStore } from "back-core";
import { runWithWorkspaceContext } from "nrpc";
import pinsMigrations from "./stores/pins/migrations";
import { DashboardPinsStoreService } from "./stores/pins/service";

describe("DashboardPinsStoreService", () => {
	let store: SqlStore;
	let pins: DashboardPinsStoreService;

	beforeEach(async () => {
		store = new SqlStore(
			":memory:",
			pinsMigrations,
			new InMemoryMigrationState(),
		);
		await store.open();
		await store.migrate();
		// A pin belongs to a dashboard, and a dashboard to a person, so this suite
		// runs as one. Whose pin is whose is `access.test.ts`.
		const impl = new DashboardPinsStoreService(store);
		pins = new Proxy(impl, {
			get(target, property, receiver) {
				const value = Reflect.get(target, property, receiver);
				if (typeof value !== "function") return value;
				return (...args: unknown[]) =>
					runWithWorkspaceContext({ user: "operator" }, () =>
						(value as (...a: unknown[]) => unknown).apply(target, args),
					);
			},
		}) as DashboardPinsStoreService;
	});

	it("stores selected indicator pins without duplicating widget ids", async () => {
		await pins.pin({
			widgetId: "orders.requests",
			title: "Requests",
			source: "sf-orders",
			position: 1,
		});
		const updated = await pins.pin({
			widgetId: "orders.requests",
			title: "Requests updated",
			source: "sf-orders",
			position: 0,
		});

		const all = await pins.list();
		expect(all).toHaveLength(1);
		expect(all[0].id).toBe(updated.id);
		expect(all[0].title).toBe("Requests updated");
		expect(all[0].position).toBe(0);
	});

	it("unpins by widget id", async () => {
		await pins.pin({ widgetId: "dag.daily-errors", title: "Daily errors" });
		await pins.unpin("dag.daily-errors");

		expect(await pins.list()).toEqual([]);
	});
});
