import { createDomain, sample } from "effector";
import { createInfiniteTableStore } from "front-core";
import galeryService from "./service";
import type { PaginationParams } from "./functions/types";

const domain = createDomain("galery");

export const galeryViewMounted = domain.createEvent("GALERY_VIEW_MOUNTED");
export const refreshGaleryClicked = domain.createEvent("REFRESH_GALERY_CLICKED");

const listGaleryItemsFx = domain.createEffect<PaginationParams, any>({
  name: "LIST_GALERY_ITEMS",
  handler: async (params: PaginationParams) => {
    return await galeryService.listOfGaleryItems(params);
  },
});

export const $galeryStore = createInfiniteTableStore(domain, listGaleryItemsFx);

sample({
  clock: galeryViewMounted,
  fn: () => ({}),
  target: $galeryStore.reset,
});

sample({
  clock: galeryViewMounted,
  fn: () => ({}),
  target: $galeryStore.loadMore,
});

sample({
  clock: refreshGaleryClicked,
  fn: () => {
    galeryService.clearCache();
    return {};
  },
  target: $galeryStore.reset,
});

sample({
  clock: refreshGaleryClicked,
  fn: () => ({}),
  target: $galeryStore.loadMore,
});

export default domain;
