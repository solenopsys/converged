import { createDomain, sample } from "effector";
import { createInfiniteTableStore } from "front-core";
import shedullerService from "./service";
import type { CronHistoryListParams } from "g-sheduller";

const domain = createDomain("sheduller-history");

export const historyViewMounted = domain.createEvent("HISTORY_VIEW_MOUNTED");
export const refreshHistoryClicked = domain.createEvent("REFRESH_HISTORY_CLICKED");

const listHistoryFx = domain.createEffect<CronHistoryListParams, any>({
  name: "LIST_HISTORY",
  handler: async (params: CronHistoryListParams) => {
    return await shedullerService.listHistory(params);
  },
});

export const $historyStore = createInfiniteTableStore(domain, listHistoryFx);

sample({
  clock: historyViewMounted,
  filter: () => {
    const state = $historyStore.$state.getState();
    return !state.isInitialized && !state.loading;
  },
  fn: () => ({}),
  target: $historyStore.loadMore,
});

sample({
  clock: refreshHistoryClicked,
  fn: () => ({}),
  target: $historyStore.reset,
});

sample({
  clock: refreshHistoryClicked,
  fn: () => ({}),
  target: $historyStore.loadMore,
});

export default domain;
