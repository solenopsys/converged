import { createInfiniteTableStore } from 'front-core';
import { sample } from 'effector';
import domain from './domain';
import dagService from './service';
import type { PaginationParams, Execution } from 'g-dag';

const executionsDataFunction = async (params: PaginationParams) => {
  return await dagService.listExecutions(params);
};

export const $executionsStore = createInfiniteTableStore<Execution>(domain, executionsDataFunction);

export const refreshExecutionsClicked = domain.createEvent('REFRESH_EXECUTIONS_CLICKED');

$executionsStore.$state.on(refreshExecutionsClicked, () => ({
  items: [],
  loading: false,
  hasMore: true,
  isInitialized: false,
  sortConfig: { key: null, direction: 'asc' },
}));

sample({ clock: refreshExecutionsClicked, fn: () => ({}), target: $executionsStore.loadMore });
