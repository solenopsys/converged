import { createDomain, sample } from "effector";
import { createInfiniteTableStore } from "front-core";
import { assistantClient } from "./services";
import { PaginationParams } from "./types";

const domain = createDomain("assistants-contexts");

export const contextsViewMounted = domain.createEvent("CONTEXTS_VIEW_MOUNTED");
export const refreshContextsClicked = domain.createEvent(
  "REFRESH_CONTEXTS_CLICKED",
);

const listContextsFx = domain.createEffect<PaginationParams, any>({
  name: "LIST_CONTEXTS",
  handler: async (params: PaginationParams) => {
    return await assistantClient.listContexts(params);
  },
});

export const $contextsStore = createInfiniteTableStore(domain, listContextsFx);

sample({
  clock: contextsViewMounted,
  filter: () => {
    const state = $contextsStore.$state.getState();
    return !state.isInitialized && !state.loading;
  },
  fn: () => ({}),
  target: $contextsStore.loadMore,
});

sample({
  clock: refreshContextsClicked,
  fn: () => ({}),
  target: $contextsStore.reset,
});

sample({
  clock: refreshContextsClicked,
  fn: () => ({}),
  target: $contextsStore.loadMore,
});

export default domain;
