import { createDomain, sample } from "effector";
import { createInfiniteTableStore } from "front-core";
import webhooksService from "./service";
import type { WebhookEndpointListParams, ProviderDefinition } from "g-webhooks";

const domain = createDomain("webhooks-endpoints");

export const endpointsViewMounted = domain.createEvent("ENDPOINTS_VIEW_MOUNTED");
export const refreshEndpointsClicked = domain.createEvent("REFRESH_ENDPOINTS_CLICKED");
export const addEndpointClicked = domain.createEvent("ADD_ENDPOINT_CLICKED");
export const openEndpointForm = domain.createEvent<{ endpoint: any }>("OPEN_ENDPOINT_FORM");

const listEndpointsFx = domain.createEffect<WebhookEndpointListParams, any>({
  name: "LIST_ENDPOINTS",
  handler: async (params: WebhookEndpointListParams) => {
    return await webhooksService.listEndpoints(params);
  },
});

const loadProvidersFx = domain.createEffect({
  name: "LOAD_PROVIDERS",
  handler: async () => {
    return await webhooksService.listProviders();
  },
});

export const $endpointsStore = createInfiniteTableStore(domain, listEndpointsFx);

const formatEndpointForForm = (endpoint: any) => {
  if (!endpoint) {
    return null;
  }
  return {
    ...endpoint,
    params: endpoint.params ? JSON.stringify(endpoint.params, null, 2) : "",
  };
};

export const $currentEndpoint = domain
  .createStore<any>(null)
  .on(openEndpointForm, (_state, { endpoint }) => formatEndpointForForm(endpoint));

export const $providers = domain
  .createStore<ProviderDefinition[]>([])
  .on(loadProvidersFx.doneData, (_state, providers) => providers);

sample({
  clock: endpointsViewMounted,
  target: loadProvidersFx,
});

sample({
  clock: endpointsViewMounted,
  filter: () => {
    const state = $endpointsStore.$state.getState();
    return !state.isInitialized && !state.loading;
  },
  fn: () => ({}),
  target: $endpointsStore.loadMore,
});

sample({
  clock: refreshEndpointsClicked,
  fn: () => ({}),
  target: $endpointsStore.reset,
});

sample({
  clock: refreshEndpointsClicked,
  fn: () => ({}),
  target: $endpointsStore.loadMore,
});

export default domain;
