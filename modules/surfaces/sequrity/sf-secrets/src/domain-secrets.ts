import { createDomain, sample } from "effector";
import { createInfiniteTableStore } from "front-core";
import type { InfiniteTableDataFunction } from "front-core/table";
import domain from "./domain";
import secretsService from "./service";

const secretsDomain = createDomain("secrets-list");

export const openSecretDetail = secretsDomain.createEvent<{ name: string }>(
	"OPEN_SECRET_DETAIL",
);

const listSecretsFx = secretsDomain.createEffect<
	Parameters<InfiniteTableDataFunction>[0],
	{ items: { name: string }[]; hasMore: boolean; total: number }
>({
	name: "LIST_SECRETS",
	handler: async (params) => {
		const names = await secretsService.listSecrets();
		const filter = (
			params.filter as { name?: Record<string, unknown> } | undefined
		)?.name;
		const value = filter?.contains ?? filter?.startsWith ?? filter?.eq;
		const filtered =
			typeof value === "string"
				? names.filter((name) => name.includes(value))
				: names;
		return {
			items: filtered.map((name) => ({ name })),
			hasMore: false,
			total: filtered.length,
		};
	},
});

export const getSecretFx = domain.createEffect<string, Record<string, string>>({
	name: "GET_SECRET",
	handler: (name) => secretsService.getSecret(name),
});

export const setSecretFx = domain.createEffect<
	{ name: string; data: Record<string, string> },
	void
>({
	name: "SET_SECRET",
	handler: ({ name, data }) => secretsService.setSecret(name, data),
});

export const deleteSecretFx = domain.createEffect<string, void>({
	name: "DELETE_SECRET",
	handler: (name) => secretsService.deleteSecret(name),
});

export const $secretsStore = createInfiniteTableStore(
	secretsDomain,
	listSecretsFx,
);
export const $currentSecret = domain.createStore<{
	name: string;
	data: Record<string, string>;
} | null>(null);

sample({
	clock: getSecretFx.doneData,
	source: openSecretDetail,
	fn: (event, data) => ({ name: event.name, data }),
	target: $currentSecret,
});

// Reload list after save/delete
sample({
	clock: [setSecretFx.done, deleteSecretFx.done],
	fn: () => ({}),
	target: $secretsStore.reset,
});
sample({
	clock: [setSecretFx.done, deleteSecretFx.done],
	fn: () => ({}),
	target: $secretsStore.loadMore,
});
