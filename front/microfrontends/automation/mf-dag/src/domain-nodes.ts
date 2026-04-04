import { createDomain, sample } from 'effector';
import { createInfiniteTableStore, PaginationParams } from 'front-core';
import dagClient from './service';

const domain = createDomain('dag-nodes');

// Events
export const nodesViewMounted = domain.createEvent('NODES_VIEW_MOUNTED');
export const refreshNodesClicked = domain.createEvent('REFRESH_NODES_CLICKED');
export const addNodeClicked = domain.createEvent('ADD_NODE_CLICKED');
export const openNodeForm = domain.createEvent<{ node: any }>('OPEN_NODE_FORM');

// Effects
const listNodesFx = domain.createEffect<PaginationParams, any>({
  name: 'LIST_NODES',
  handler: async (params: PaginationParams) => {
    const result = await dagClient.nodeList();
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

export const createNodeFx = domain.createEffect<any, any>({
  name: 'CREATE_NODE',
  handler: async (data) => {
    const result = await dagClient.createNode(data.name, data.nodeConfigHash);
    return result;
  }
});

// Store
export const $nodesStore = createInfiniteTableStore(domain, listNodesFx);

// Current node being edited
export const $currentNode = domain.createStore<any>(null);
sample({ clock: openNodeForm, fn: ({ node }) => node || null, target: $currentNode });

// Clear current node after save
sample({ clock: createNodeFx.done, fn: () => null, target: $currentNode });

// Reload list after create
sample({
  clock: createNodeFx.done,
  fn: () => ({}),
  target: $nodesStore.reset
});

sample({
  clock: createNodeFx.done,
  fn: () => ({}),
  target: $nodesStore.loadMore
});

// Load data when view mounts
sample({
  clock: nodesViewMounted,
  filter: () => {
    const state = $nodesStore.$state.getState();
    return !state.isInitialized && !state.loading;
  },
  fn: () => ({}),
  target: $nodesStore.loadMore
});

// Refresh action
sample({
  clock: refreshNodesClicked,
  fn: () => ({}),
  target: $nodesStore.reset
});

sample({
  clock: refreshNodesClicked,
  fn: () => ({}),
  target: $nodesStore.loadMore
});

export default domain;
