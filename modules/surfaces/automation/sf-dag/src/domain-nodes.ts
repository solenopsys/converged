import { createDomain, sample } from "effector";
import { createInfiniteTableStore, type PaginationParams } from "front-core";
import dagClient from "./service";

const domain = createDomain("dag-nodes");

export const openNodeForm = domain.createEvent<{ node: any }>("OPEN_NODE_FORM");

const listNodesFx = domain.createEffect<PaginationParams, any>({
	name: "LIST_NODES",
	handler: async (params: PaginationParams) => {
		const result = await dagClient.nodeList();
		const items = result.names
			.filter((name: string) => {
				const filter = (
					params.filter as { name?: Record<string, unknown> } | undefined
				)?.name;
				const value = filter?.contains ?? filter?.startsWith ?? filter?.eq;
				return typeof value !== "string" || name.includes(value);
			})
			.map((name: string) => ({
				name,
				codeSource: "",
			}));
		return {
			items,
			totalCount: items.length,
		};
	},
});

export const createNodeFx = domain.createEffect<any, any>({
	name: "CREATE_NODE",
	handler: async (data) => {
		const result = await dagClient.createNode(data.name, data.nodeConfigHash);
		return result;
	},
});

export const $nodesStore = createInfiniteTableStore(domain, listNodesFx);

// Current node being edited
export const $currentNode = domain.createStore<any>(null);
sample({
	clock: openNodeForm,
	fn: ({ node }) => node || null,
	target: $currentNode,
});

// Clear current node after save
sample({ clock: createNodeFx.done, fn: () => null, target: $currentNode });

// Reload list after create
sample({
	clock: createNodeFx.done,
	fn: () => ({}),
	target: $nodesStore.reset,
});

sample({
	clock: createNodeFx.done,
	fn: () => ({}),
	target: $nodesStore.loadMore,
});

export default domain;
