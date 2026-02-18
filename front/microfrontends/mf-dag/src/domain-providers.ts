import { createDomain, sample } from 'effector';
import { createInfiniteTableStore, PaginationParams } from 'front-core';
import dagClient from './service';

const domain = createDomain('dag-providers');

// Events
export const providersViewMounted = domain.createEvent('PROVIDERS_VIEW_MOUNTED');
export const refreshProvidersClicked = domain.createEvent('REFRESH_PROVIDERS_CLICKED');
export const addProviderClicked = domain.createEvent('ADD_PROVIDER_CLICKED');
export const openProviderForm = domain.createEvent<{ provider: any }>('OPEN_PROVIDER_FORM');

// Effects
const listProvidersFx = domain.createEffect<PaginationParams, any>({
  name: 'LIST_PROVIDERS',
  handler: async (params: PaginationParams) => {
    const result = await dagClient.providerList();
    const items = result.names.map((name: string) => ({
      name,
      codeSource: '',
    }));
    return {
      items,
      totalCount: items.length,
    };
  }
});

export const createProviderFx = domain.createEffect<any, any>({
  name: 'CREATE_PROVIDER',
  handler: async (data) => {
    const result = await dagClient.createProvider(data.name, data.codeSource, data.config || {});
    return result;
  }
});

// Store
export const $providersStore = createInfiniteTableStore(domain, listProvidersFx);

// Current provider being edited
export const $currentProvider = domain.createStore<any>(null);
sample({ clock: openProviderForm, fn: ({ provider }) => provider || null, target: $currentProvider });

// Clear current provider after save
sample({ clock: createProviderFx.done, fn: () => null, target: $currentProvider });

// Reload list after create
sample({
  clock: createProviderFx.done,
  fn: () => ({}),
  target: $providersStore.reset
});

sample({
  clock: createProviderFx.done,
  fn: () => ({}),
  target: $providersStore.loadMore
});

// Load data when view mounts
sample({
  clock: providersViewMounted,
  filter: () => {
    const state = $providersStore.$state.getState();
    return !state.isInitialized && !state.loading;
  },
  fn: () => ({}),
  target: $providersStore.loadMore
});

// Refresh action
sample({
  clock: refreshProvidersClicked,
  fn: () => ({}),
  target: $providersStore.reset
});

sample({
  clock: refreshProvidersClicked,
  fn: () => ({}),
  target: $providersStore.loadMore
});

export default domain;
