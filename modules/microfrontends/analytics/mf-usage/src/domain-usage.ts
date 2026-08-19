import { createDomain, sample } from "effector";
import { createInfiniteTableStore } from "front-core";
import usageService from "./service";
import type { UsageListParams } from "g-usage";

const domain = createDomain("usage-events");

export const usageViewMounted = domain.createEvent("USAGE_VIEW_MOUNTED");
export const refreshUsageClicked = domain.createEvent("REFRESH_USAGE_CLICKED");

const listUsageFx = domain.createEffect<UsageListParams, any>({
  name: "LIST_USAGE",
  handler: async (params: UsageListParams) => {
    return await usageService.listUsage(params);
  },
});

export const $usageStore = createInfiniteTableStore(domain, listUsageFx);

sample({
  clock: usageViewMounted,
  filter: () => {
    const state = $usageStore.$state.getState();
    return !state.isInitialized && !state.loading;
  },
  fn: () => ({}),
  target: $usageStore.loadMore,
});

sample({
  clock: refreshUsageClicked,
  fn: () => ({}),
  target: $usageStore.reset,
});

sample({
  clock: refreshUsageClicked,
  fn: () => ({}),
  target: $usageStore.loadMore,
});

export default domain;
