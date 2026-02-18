import { createInfiniteTableStore } from 'front-core';
import domain from './domain';
import dagService from './service';
import type { PaginationParams, NodeExecution } from 'g-dag';

const executionsDataFunction = async (params: PaginationParams) => {
  return await dagService.listNodes(params);
};

export const $executionsStore = createInfiniteTableStore<NodeExecution>(domain, executionsDataFunction);

export const refreshExecutionsClicked = domain.createEvent('REFRESH_EXECUTIONS_CLICKED');

$executionsStore.$state.on(refreshExecutionsClicked, () => ({
  items: [],
  loading: false,
  hasMore: true,
  isInitialized: false,
}));
