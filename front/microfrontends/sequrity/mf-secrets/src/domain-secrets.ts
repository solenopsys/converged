import { createDomain, sample } from "effector";
import { createInfiniteTableStore } from "front-core";
import secretsService from "./service";
import domain from "./domain";

const secretsDomain = createDomain("secrets-list");

// Events
export const secretsViewMounted = secretsDomain.createEvent("SECRETS_VIEW_MOUNTED");
export const refreshSecretsClicked = secretsDomain.createEvent("REFRESH_SECRETS_CLICKED");
export const openSecretDetail = secretsDomain.createEvent<{ name: string }>("OPEN_SECRET_DETAIL");

// Effects
const listSecretsFx = secretsDomain.createEffect({
  name: "LIST_SECRETS",
  handler: async () => {
    const names = await secretsService.listSecrets();
    return { items: names.map((name) => ({ name })), hasMore: false, total: names.length };
  },
});

export const getSecretFx = domain.createEffect<string, Record<string, string>>({
  name: "GET_SECRET",
  handler: (name) => secretsService.getSecret(name),
});

export const setSecretFx = domain.createEffect<{ name: string; data: Record<string, string> }, void>({
  name: "SET_SECRET",
  handler: ({ name, data }) => secretsService.setSecret(name, data),
});

export const deleteSecretFx = domain.createEffect<string, void>({
  name: "DELETE_SECRET",
  handler: (name) => secretsService.deleteSecret(name),
});

// Stores
export const $secretsStore = createInfiniteTableStore(secretsDomain, listSecretsFx);
export const $currentSecret = domain.createStore<{ name: string; data: Record<string, string> } | null>(null);

sample({ clock: getSecretFx.doneData, source: openSecretDetail, fn: (event, data) => ({ name: event.name, data }), target: $currentSecret });

// Load on mount
sample({
  clock: secretsViewMounted,
  filter: () => {
    const state = $secretsStore.$state.getState();
    return !state.isInitialized && !state.loading;
  },
  fn: () => ({}),
  target: $secretsStore.loadMore,
});

// Refresh
sample({ clock: refreshSecretsClicked, fn: () => ({}), target: $secretsStore.reset });
sample({ clock: refreshSecretsClicked, fn: () => ({}), target: $secretsStore.loadMore });

// Reload list after save/delete
sample({ clock: [setSecretFx.done, deleteSecretFx.done], fn: () => ({}), target: $secretsStore.reset });
sample({ clock: [setSecretFx.done, deleteSecretFx.done], fn: () => ({}), target: $secretsStore.loadMore });
