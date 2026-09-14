import { beforeEach, describe, expect, it } from "bun:test";
import { InMemoryMigrationState, SqlStore } from "back-core";
import { runWithWorkspaceContext } from "nrpc";
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
		// Orders are access-narrowed now, so this suite runs as one operator.
		// What is under test here is the order model and its dashboard; who sees
		// what is `access.test.ts`.
		const impl = new OrdersStoreService(store);
		orders = new Proxy(impl, {
			get(target, property, receiver) {
				const value = Reflect.get(target, property, receiver);
				if (typeof value !== "function") return value;
				return (...args: unknown[]) =>
					runWithWorkspaceContext({ user: "operator" }, () =>
						(value as (...a: unknown[]) => unknown).apply(target, args),
					);
			},
		}) as OrdersStoreService;
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
		expect(dashboard.stats.utilizationPercent).toBe(50);
		expect(dashboard.stats.completedTotal).toBe(1);
		expect(dashboard.stats.materialWeightGrams).toBe(161);
		expect(dashboard.daily).toHaveLength(90);
	});

	it("applies the standard filter to lists and selection counts", async () => {
		await orders.createOrder({
			modelName: "Queued part",
			productionMethod: "fdm",
			status: "queued",
		});
		await orders.createOrder({
			modelName: "Completed part",
			productionMethod: "sla",
			status: "completed",
		});

		const filter = { status: { eq: "queued" } };
		const list = await orders.listOrders({ offset: 0, limit: 10, filter });

		expect(list.items).toHaveLength(1);
		expect(list.items[0].modelName).toBe("Queued part");
		expect(await orders.countOrders(filter)).toBe(1);
	});

	it("keeps the customer the work was done for, and finds orders by when they changed", async () => {
		const id = await orders.createOrder({
			modelName: "Bracket",
			productionMethod: "fdm",
			status: "completed",
			customerName: "Ann",
			customerEmail: "ann@example.com",
			customerLang: "en",
		});

		expect(await orders.getOrder(id)).toMatchObject({
			customerName: "Ann",
			customerEmail: "ann@example.com",
			customerLang: "en",
		});

		// How the review funnel asks for "completed, and left alone since".
		const future = new Date(Date.now() + 60_000).toISOString();
		const due = await orders.listOrders({
			offset: 0,
			limit: 10,
			status: "completed",
			filter: { updatedAt: { lte: future } },
		});
		expect(due.items.map((order) => order.id)).toContain(id);

		const past = new Date(Date.now() - 60_000).toISOString();
		expect(await orders.countOrders({ updatedAt: { lte: past } })).toBe(0);
	});
});
