import { createInfiniteTableStore } from 'front-core';
import { sample } from 'effector';
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
  sortConfig: { key: null, direction: 'asc' },
}));

sample({ clock: refreshContextsClicked, fn: () => ({}), target: $contextsStore.loadMore });

// Детальный просмотр контекста
export const openContextDetail = domain.createEvent<{ contextId: string }>('OPEN_CONTEXT_DETAIL');
export const $selectedContext = domain.createStore<any>(null);

const loadContextFx = domain.createEffect<string, any>({
  handler: (id) => dagService.getContext(id),
});

sample({ clock: openContextDetail, fn: ({ contextId }) => contextId, target: loadContextFx });
sample({ clock: loadContextFx.doneData, target: $selectedContext });
