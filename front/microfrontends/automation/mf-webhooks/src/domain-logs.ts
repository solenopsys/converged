import { createDomain, sample } from "effector";
import { createInfiniteTableStore } from "front-core";
import webhooksService from "./service";
import type { WebhookLogListParams } from "g-webhooks";

const domain = createDomain("webhooks-logs");

export const logsViewMounted = domain.createEvent<{ endpointId?: string }>("LOGS_VIEW_MOUNTED");
export const refreshLogsClicked = domain.createEvent("REFRESH_LOGS_CLICKED");

const $logFilter = domain
  .createStore<{ endpointId?: string }>({})
  .on(logsViewMounted, (_state, payload) => ({ endpointId: payload?.endpointId }));

const listLogsFx = domain.createEffect<WebhookLogListParams, any>({
  name: "LIST_LOGS",
  handler: async (params: WebhookLogListParams) => {
    const filter = $logFilter.getState();
    return await webhooksService.listLogs({
      ...params,
      endpointId: filter.endpointId,
    });
  },
});

export const $logsStore = createInfiniteTableStore(domain, listLogsFx);

sample({
  clock: logsViewMounted,
  fn: () => ({}),
  target: $logsStore.reset,
});

sample({
  clock: logsViewMounted,
  fn: () => ({}),
  target: $logsStore.loadMore,
});

sample({
  clock: refreshLogsClicked,
  fn: () => ({}),
  target: $logsStore.reset,
});

sample({
  clock: refreshLogsClicked,
  fn: () => ({}),
  target: $logsStore.loadMore,
});

export default domain;
