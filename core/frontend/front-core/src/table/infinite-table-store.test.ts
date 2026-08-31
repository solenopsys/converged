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
});
