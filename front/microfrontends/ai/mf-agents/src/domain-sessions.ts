import { createDomain, sample } from "effector";
import { createInfiniteTableStore } from "front-core";
import { agentClient } from "./services";
import type { PaginationParams } from "./types";

const domain = createDomain("agents-sessions");

export const sessionsListMounted = domain.createEvent("SESSIONS_LIST_MOUNTED");
export const refreshSessionsClicked = domain.createEvent("REFRESH_SESSIONS_CLICKED");
export const createSessionClicked = domain.createEvent("CREATE_SESSION_CLICKED");
export const openSessionDetail = domain.createEvent<{ recordId: string }>("OPEN_SESSION_DETAIL");

const listSessionsFx = domain.createEffect<PaginationParams, any>({
  name: "LIST_SESSIONS",
  handler: async (params: PaginationParams) => {
    return await agentClient.listSessions(params);
  },
});

export const $sessionsStore = createInfiniteTableStore(domain, listSessionsFx);

sample({
  clock: sessionsListMounted,
  filter: () => {
    const state = $sessionsStore.$state.getState();
    return !state.isInitialized && !state.loading;
  },
  fn: () => ({}),
  target: $sessionsStore.loadMore,
});

sample({
  clock: refreshSessionsClicked,
  fn: () => ({}),
  target: $sessionsStore.reset,
});

sample({
  clock: refreshSessionsClicked,
  fn: () => ({}),
  target: $sessionsStore.loadMore,
});

export default domain;
