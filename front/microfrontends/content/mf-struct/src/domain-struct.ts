import { createDomain, sample } from "effector";
import { createInfiniteTableStore } from "front-core";
import structService from "./service";
import type { PaginationParams } from "./functions/types";

const domain = createDomain("struct");

export const structViewMounted = domain.createEvent("STRUCT_VIEW_MOUNTED");
export const refreshStructClicked = domain.createEvent("REFRESH_STRUCT_CLICKED");

const listStructFx = domain.createEffect<PaginationParams, any>({
  name: "LIST_STRUCT",
  handler: async (params: PaginationParams) => {
    return await structService.listOfStruct(params);
  },
});

export const $structStore = createInfiniteTableStore(domain, listStructFx);

sample({
  clock: structViewMounted,
  fn: () => ({}),
  target: $structStore.reset,
});

sample({
  clock: structViewMounted,
  fn: () => ({}),
  target: $structStore.loadMore,
});

sample({
  clock: refreshStructClicked,
  fn: () => ({}),
  target: $structStore.reset,
});

sample({
  clock: refreshStructClicked,
  fn: () => ({}),
  target: $structStore.loadMore,
});

export default domain;
