import { createDomain, sample } from "effector";
import { createInfiniteTableStore } from "front-core";
import shedullerService from "./service";
import type { CronListParams, ProviderDefinition } from "g-sheduller";

const domain = createDomain("sheduller-crons");

export const cronsViewMounted = domain.createEvent("CRONS_VIEW_MOUNTED");
export const refreshCronsClicked = domain.createEvent("REFRESH_CRONS_CLICKED");
export const addCronClicked = domain.createEvent("ADD_CRON_CLICKED");
export const openCronForm = domain.createEvent<{ cron: any }>("OPEN_CRON_FORM");
export const providersLoaded = domain.createEvent<ProviderDefinition[]>("PROVIDERS_LOADED");

const listCronsFx = domain.createEffect<CronListParams, any>({
  name: "LIST_CRONS",
  handler: async (params: CronListParams) => {
    return await shedullerService.listCrons(params);
  },
});

const loadProvidersFx = domain.createEffect({
  name: "LOAD_PROVIDERS",
  handler: async () => {
    return await shedullerService.listProviders();
  },
});

export const $cronsStore = createInfiniteTableStore(domain, listCronsFx);

export const $currentCron = domain.createStore<any>(null);
sample({ clock: openCronForm, fn: ({ cron }) => cron || null, target: $currentCron });

export const $providers = domain.createStore<ProviderDefinition[]>([])
  .on(loadProvidersFx.doneData, (_, providers) => providers);

sample({
  clock: cronsViewMounted,
  target: loadProvidersFx,
});

sample({
  clock: cronsViewMounted,
  filter: () => {
    const state = $cronsStore.$state.getState();
    return !state.isInitialized && !state.loading;
  },
  fn: () => ({}),
  target: $cronsStore.loadMore,
});

sample({
  clock: refreshCronsClicked,
  fn: () => ({}),
  target: $cronsStore.reset,
});

sample({
  clock: refreshCronsClicked,
  fn: () => ({}),
  target: $cronsStore.loadMore,
});

export default domain;
