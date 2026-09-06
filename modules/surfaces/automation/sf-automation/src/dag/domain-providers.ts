import { createDomain, sample } from "effector";
import { createInfiniteTableStore, type PaginationParams } from "front-core";
import dagClient from "./service";

const domain = createDomain("dag-providers");

export const openProviderForm = domain.createEvent<{ provider: any }>(
	"OPEN_PROVIDER_FORM",
);

const listProvidersFx = domain.createEffect<PaginationParams, any>({
	name: "LIST_PROVIDERS",
	handler: async (params: PaginationParams) => {
		const result = await dagClient.providerList();
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

export const createProviderFx = domain.createEffect<any, any>({
	name: "CREATE_PROVIDER",
	handler: async (data) => {
		const result = await dagClient.createProvider(
			data.name,
			data.codeSource,
			data.config || {},
		);
		return result;
	},
});

export const $providersStore = createInfiniteTableStore(
	domain,
	listProvidersFx,
);

// Current provider being edited
export const $currentProvider = domain.createStore<any>(null);
sample({
	clock: openProviderForm,
	fn: ({ provider }) => provider || null,
	target: $currentProvider,
});

// Clear current provider after save
sample({
	clock: createProviderFx.done,
	fn: () => null,
	target: $currentProvider,
});

// Reload list after create
sample({
	clock: createProviderFx.done,
	fn: () => ({}),
	target: $providersStore.reset,
});

sample({
	clock: createProviderFx.done,
	fn: () => ({}),
	target: $providersStore.loadMore,
});

export default domain;
