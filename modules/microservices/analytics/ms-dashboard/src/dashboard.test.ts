import { beforeEach, describe, expect, it } from "bun:test";
import { InMemoryMigrationState, SqlStore } from "back-core";
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
		pins = new DashboardPinsStoreService(store);
	});

	it("stores selected indicator pins without duplicating widget ids", async () => {
		await pins.pin({
			widgetId: "orders.requests",
			title: "Requests",
			source: "mf-orders",
			position: 1,
		});
		const updated = await pins.pin({
			widgetId: "orders.requests",
			title: "Requests updated",
			source: "mf-orders",
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
