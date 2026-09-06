import { describe, expect, test } from "bun:test";
import { createDomain } from "effector";
import { createInfiniteTableStore } from "./infinite-table-store";

describe("createInfiniteTableStore", () => {
	test("reloads with a server filter and preserves the server total", async () => {
		const requests: Array<Record<string, unknown>> = [];
		const store = createInfiniteTableStore(
			createDomain("filtered-table-test"),
			async (params) => {
				requests.push(params);
				return { items: [{ id: "active-company" }], totalCount: 17 };
			},
		);

		const loaded = new Promise<void>((resolve) => {
			const stop = store.loadDataFx.done.watch(() => {
				stop();
				resolve();
			});
		});
		store.setFilters({ filter: { status: { eq: "active" } } });
		await loaded;

		expect(requests).toEqual([
			{
				limit: 20,
				offset: 0,
				filter: { status: { eq: "active" } },
			},
		]);
		expect(store.$state.getState()).toMatchObject({
			totalCount: 17,
			items: [{ id: "active-company" }],
			filters: { filter: { status: { eq: "active" } } },
		});
	});

	test("continues loading when a paginated source omits totalCount", async () => {
		const requests: Array<Record<string, unknown>> = [];
		const store = createInfiniteTableStore(
			createDomain("unknown-total-table-test"),
			async (params) => {
				requests.push(params);
				const offset = Number(params.offset);
				return {
					items:
						offset === 0
							? Array.from({ length: 20 }, (_, id) => ({ id }))
							: [{ id: 20 }],
				};
			},
		);

		const waitForLoad = () =>
			new Promise<void>((resolve) => {
				const stop = store.loadDataFx.done.watch(() => {
					stop();
					resolve();
				});
			});

		let loaded = waitForLoad();
		store.loadMore();
		await loaded;
		expect(store.$state.getState().hasMore).toBe(true);

		loaded = waitForLoad();
		store.loadMore();
		await loaded;
		expect(requests.map((request) => request.offset)).toEqual([0, 20]);
		expect(store.$state.getState()).toMatchObject({
			items: Array.from({ length: 21 }, (_, id) => ({ id })),
			hasMore: false,
		});
	});
});
