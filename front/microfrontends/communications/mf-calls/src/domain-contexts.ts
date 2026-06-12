import { createDomain, sample } from "effector";
import { createInfiniteTableStore } from "front-core";
import { callsClient, type CallContextListParams } from "g-calls";

const domain = createDomain("calls-contexts");

export const contextsViewMounted = domain.createEvent("CONTEXTS_VIEW_MOUNTED");
export const refreshContextsClicked = domain.createEvent("REFRESH_CONTEXTS_CLICKED");

const listContextsFx = domain.createEffect<CallContextListParams, any>({
  name: "LIST_CALL_CONTEXTS",
  handler: async (params: CallContextListParams) => {
    return await callsClient.listContexts(params);
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
