import { createDomain, sample } from "effector";
import { createInfiniteTableStore } from "front-core";
import markdownService from "./service";
import type { PaginationParams, MdFile } from "./functions/types";

const domain = createDomain("markdown");

export const mdViewMounted = domain.createEvent("MD_VIEW_MOUNTED");
export const refreshMdClicked = domain.createEvent("REFRESH_MD_CLICKED");
export const editMdClicked = domain.createEvent<MdFile>("EDIT_MD_CLICKED");
export const saveMdClicked = domain.createEvent<MdFile>("SAVE_MD_CLICKED");

export const $selectedMd = domain.createStore<MdFile | null>(null);

$selectedMd.on(editMdClicked, (_, md) => md);

const listMdFx = domain.createEffect<PaginationParams, any>({
  name: "LIST_MD",
  handler: async (params: PaginationParams) => {
    return await markdownService.listOfMd(params);
  },
});

const saveMdFx = domain.createEffect<MdFile, any>({
  name: "SAVE_MD",
  handler: async (mdFile: MdFile) => {
    return await markdownService.saveMd(mdFile);
  },
});

export const $mdStore = createInfiniteTableStore(domain, listMdFx);

sample({
  clock: mdViewMounted,
  fn: () => ({}),
  target: $mdStore.reset,
});

sample({
  clock: mdViewMounted,
  fn: () => ({}),
  target: $mdStore.loadMore,
});

sample({
  clock: refreshMdClicked,
  fn: () => ({}),
  target: $mdStore.reset,
});

sample({
  clock: refreshMdClicked,
  fn: () => ({}),
  target: $mdStore.loadMore,
});

sample({
  clock: saveMdClicked,
  target: saveMdFx,
});

sample({
  clock: saveMdFx.done,
  fn: () => ({}),
  target: $mdStore.reset,
});

sample({
  clock: saveMdFx.done,
  fn: () => ({}),
  target: $mdStore.loadMore,
});

export default domain;
