import { beforeEach, describe, expect, it } from "bun:test";
import { InMemoryMigrationState, SqlStore } from "back-core";
import ordersMigrations from "./stores/orders/migrations";
import { OrdersStoreService } from "./stores/orders/service";

describe("OrdersStoreService in-memory", () => {
	let store: SqlStore;
	let orders: OrdersStoreService;

	beforeEach(async () => {
		store = new SqlStore(
			":memory:",
			ordersMigrations,
			new InMemoryMigrationState(),
		);
		await store.open();
		await store.migrate();
		orders = new OrdersStoreService(store);
	});

	it("creates and lists production orders separately from requests", async () => {
		const id = await orders.createOrder({
			requestId: "req-1",
			modelName: "Protective smartphone case",
			productionMethod: "fdm",
			status: "queued",
			quantity: 5,
			weightGrams: 28,
			material: "TPU",
		});

		const saved = await orders.getOrder(id);
		expect(saved?.requestId).toBe("req-1");
		expect(saved?.modelName).toBe("Protective smartphone case");
		expect(saved?.quantity).toBe(5);

		const listed = await orders.listOrders({ offset: 0, limit: 10 });
		expect(listed.items).toHaveLength(1);
		expect(listed.totalCount).toBe(1);
	});

	it("filters by operational status group and builds dashboard stats", async () => {
		await orders.createOrder({
			modelName: "Gears for clock mechanism",
			productionMethod: "sla",
			status: "completed",
			quantity: 12,
			weightGrams: 3,
		});
		await orders.createOrder({
			modelName: "Drone parts set",
			productionMethod: "fdm",
			status: "in_progress",
			quantity: 1,
			weightGrams: 125,
		});

		const inProgress = await orders.listOrders({
			offset: 0,
			limit: 10,
			statusGroup: "in_progress",
		});
		expect(inProgress.items).toHaveLength(1);
		expect(inProgress.items[0].status).toBe("in_progress");

		const dashboard = await orders.getOrderDashboard();
		expect(dashboard.stats.ordersTotal).toBe(2);
		expect(dashboard.stats.inProgressTotal).toBe(1);
		expect(dashboard.stats.printingTotal).toBe(1);
		expect(dashboard.stats.availablePrinters).toBe(8);
		expect(dashboard.stats.completedTotal).toBe(1);
		expect(dashboard.stats.materialWeightGrams).toBe(161);
		expect(dashboard.daily).toHaveLength(90);
	});
});
