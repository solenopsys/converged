import { createDomain, sample } from "effector";
import { createInfiniteTableStore } from "front-core";
import staticService from "./service";
import type {
  PaginationParams,
  StaticContentType,
  StaticFilters,
  StaticStatus,
} from "./functions/types";

const domain = createDomain("static-cache");

export const staticViewMounted = domain.createEvent("STATIC_VIEW_MOUNTED");
export const refreshStaticClicked = domain.createEvent("REFRESH_STATIC_CLICKED");
export const flushStaticClicked = domain.createEvent("FLUSH_STATIC_CLICKED");
export const createStaticMetaClicked = domain.createEvent<{
  id: string;
  contentType: StaticContentType;
}>();
export const setStatusPatternClicked = domain.createEvent<{
  pattern: string;
  status: StaticStatus;
}>();
export const filterChanged = domain.createEvent<StaticFilters>();

export const $filters = domain.createStore<StaticFilters>({});

$filters.on(filterChanged, (_state, filters) => filters);

const listStaticFx = domain.createEffect<PaginationParams, any>({
  name: "LIST_STATIC_CACHE",
  handler: async (params: PaginationParams) => {
    return await staticService.listMeta({
      ...params,
      ...$filters.getState(),
    });
  },
});

const flushStaticFx = domain.createEffect<void, any>({
  name: "FLUSH_STATIC_CACHE",
  handler: async () => {
    return await staticService.flush();
  },
});

const createStaticMetaFx = domain.createEffect<
  { id: string; contentType: StaticContentType },
  any
>({
  name: "CREATE_STATIC_META",
  handler: async (params) => {
    return await staticService.setMeta({
      ...params,
      status: "todo" as StaticStatus,
    });
  },
});

const setStatusPatternFx = domain.createEffect<
  { pattern: string; status: StaticStatus },
  any
>({
  name: "SET_STATIC_STATUS_PATTERN",
  handler: async (params) => {
    return await staticService.setStatusPattern(params);
  },
});

export const $staticStore = createInfiniteTableStore(domain, listStaticFx);

sample({
  clock: staticViewMounted,
  fn: () => ({}),
  target: $staticStore.reset,
});

sample({
  clock: staticViewMounted,
  fn: () => ({}),
  target: $staticStore.loadMore,
});

sample({
  clock: refreshStaticClicked,
  fn: () => ({}),
  target: $staticStore.reset,
});

sample({
  clock: refreshStaticClicked,
  fn: () => ({}),
  target: $staticStore.loadMore,
});

sample({
  clock: filterChanged,
  fn: () => ({}),
  target: $staticStore.reset,
});

sample({
  clock: filterChanged,
  fn: () => ({}),
  target: $staticStore.loadMore,
});

sample({
  clock: flushStaticClicked,
  target: flushStaticFx,
});

sample({
  clock: flushStaticFx.done,
  fn: () => ({}),
  target: $staticStore.reset,
});

sample({
  clock: flushStaticFx.done,
  fn: () => ({}),
  target: $staticStore.loadMore,
});

sample({
  clock: createStaticMetaClicked,
  target: createStaticMetaFx,
});

sample({
  clock: createStaticMetaFx.done,
  fn: () => ({}),
  target: $staticStore.reset,
});

sample({
  clock: createStaticMetaFx.done,
  fn: () => ({}),
  target: $staticStore.loadMore,
});

sample({
  clock: setStatusPatternClicked,
  target: setStatusPatternFx,
});

sample({
  clock: setStatusPatternFx.done,
  fn: () => ({}),
  target: $staticStore.reset,
});

sample({
  clock: setStatusPatternFx.done,
  fn: () => ({}),
  target: $staticStore.loadMore,
});

export default domain;
