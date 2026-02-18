import { createInfiniteTableStore } from 'front-core';
import domain from './domain';
import dagService from './service';
import type { PaginationParams, ContextInfo } from 'g-dag';

const contextsDataFunction = async (params: PaginationParams) => {
  return await dagService.listContexts(params);
};

export const $contextsStore = createInfiniteTableStore<ContextInfo>(domain, contextsDataFunction);

// Event для обновления
export const refreshContextsClicked = domain.createEvent('REFRESH_CONTEXTS_CLICKED');

// При клике на refresh - перезагружаем
$contextsStore.$state.on(refreshContextsClicked, () => ({
  items: [],
  loading: false,
  hasMore: true,
  isInitialized: false,
}));
