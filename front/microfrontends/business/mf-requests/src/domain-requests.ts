import { createDomain, sample } from "effector";
import { createInfiniteTableStore } from "front-core";
import { requestsClient } from "./services";

const domain = createDomain("mf-requests");

export const requestsListMounted  = domain.createEvent("REQUESTS_LIST_MOUNTED");
export const refreshRequestsClicked = domain.createEvent("REFRESH_REQUESTS_CLICKED");
export const openRequestDetail    = domain.createEvent<{ recordId: string }>("OPEN_REQUEST_DETAIL");

const listRequestsFx = domain.createEffect({
  name: "LIST_REQUESTS",
  handler: async (params: { offset: number; limit: number }) => {
    return requestsClient.listRequests(params);
  },
});

export const $requestsStore = createInfiniteTableStore(domain, listRequestsFx);

sample({
  clock: requestsListMounted,
  filter: () => {
    const s = $requestsStore.$state.getState();
    return !s.isInitialized && !s.loading;
  },
  fn: () => ({}),
  target: $requestsStore.loadMore,
});

sample({
  clock: refreshRequestsClicked,
  fn: () => ({}),
  target: $requestsStore.reset,
});

sample({
  clock: refreshRequestsClicked,
  fn: () => ({}),
  target: $requestsStore.loadMore,
});

export default domain;
