import { beforeEach, describe, expect, it } from "bun:test";
import { AccessDeniedError, InMemoryMigrationState, SqlStore } from "back-core";
import { runWithWorkspaceContext } from "nrpc";
import ordersMigrations from "./stores/orders/migrations";
import { OrdersStoreService } from "./stores/orders/service";

/**
 * A production order is shop-wide by meaning, so it is born `authenticated`:
 * the floor keeps seeing the queue it saw before. What the tags add is the
 * other two answers — an unauthenticated caller sees nothing, and editing is
 * still limited to the order's own people.
 */
describe("who sees which orders", () => {
	let store: SqlStore;
	let orders: OrdersStoreService;

	const as = <T>(user: string, fn: () => T, tags?: string[]) =>
		runWithWorkspaceContext({ user, accessTags: tags }, fn);

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

	const place = (actor: string, modelName = "bracket") =>
		as(actor, () =>
			orders.createOrder({
				modelName,
				productionMethod: "fdm",
				quantity: 1,
				weightGrams: 10,
			} as any),
		);

	it("shows the shop queue to any authenticated caller", async () => {
		await place("alice");
		await place("bob");

		const forCarol = await as("carol", () =>
			orders.listOrders({ offset: 0, limit: 10 } as any),
		);
		expect(forCarol.items).toHaveLength(2);
		expect(forCarol.totalCount).toBe(2);
	});

	it("shows nothing to a caller with no token", async () => {
		await place("alice");

		const anonymous = await orders.listOrders({ offset: 0, limit: 10 } as any);
		expect(anonymous.items).toHaveLength(0);
		expect(anonymous.totalCount).toBe(0);
		expect(await orders.countOrders()).toBe(0);
	});

	it("refuses an edit from someone the order is merely visible to", async () => {
		const mine = await place("alice");

		await as("bob", async () => {
			expect(orders.patchOrder(mine, { quantity: 99 })).rejects.toThrow(
				AccessDeniedError,
			);
			expect(orders.updateStatus(mine, "completed" as any)).rejects.toThrow(
				AccessDeniedError,
			);
		});
		expect(
			(await as("alice", () => orders.patchOrder(mine, { quantity: 9 })))
				.quantity,
		).toBe(9);
	});

	it("lets a team tag stand in for ownership when editing", async () => {
		const mine = await place("alice");
		await orders.access.grant(mine, "team-production");

		expect(
			await as(
				"agent",
				() => orders.patchOrder(mine, { status: "in_progress" as any }),
				["team-production"],
			),
		).toMatchObject({ status: "in_progress" });
	});

	it("narrows to a team once the open tag is dropped", async () => {
		const mine = await place("alice");
		await orders.access.setVisibility(mine, "private");
		await orders.access.grant(mine, "team-production");

		expect(await as("carol", () => orders.getOrder(mine))).toBeUndefined();
		expect(
			await as("agent", () => orders.getOrder(mine), ["team-production"]),
		).toMatchObject({ id: mine });
	});

	it("does not let the dashboard count what the caller cannot see", async () => {
		await place("alice");
		await place("bob");

		expect(
			(await as("carol", () => orders.getOrderDashboard())).stats.ordersTotal,
		).toBe(2);
		expect((await orders.getOrderDashboard()).stats.ordersTotal).toBe(0);
	});
});
