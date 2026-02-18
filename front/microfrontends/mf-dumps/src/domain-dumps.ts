import { createDomain, sample } from 'effector';
import { createInfiniteTableStore } from 'front-core';
import dumpsService from './service';
import { PaginationParams } from './functions/types';

const domain = createDomain('dumps');

export type DumpsMode = 'dumps' | 'storages';

export const dumpsViewMounted = domain.createEvent<{ mode: DumpsMode }>(
  'DUMPS_VIEW_MOUNTED',
);
export const refreshDumpsClicked = domain.createEvent('REFRESH_DUMPS_CLICKED');

const $dumpsMode = domain.createStore<DumpsMode>('dumps');

$dumpsMode.on(dumpsViewMounted, (_state, payload) => payload.mode);

const listDumpsFx = domain.createEffect<PaginationParams, any>({
  name: 'LIST_DUMPS',
  handler: async (params: PaginationParams) => {
    const mode = $dumpsMode.getState();
    if (mode === 'storages') {
      const storages = await dumpsService.listStorages();
      const items = Array.isArray(storages) ? storages : [];
      const offset = params?.offset ?? 0;
      const limit = params?.limit ?? items.length;
      return {
        items: items.slice(offset, offset + limit),
        totalCount: items.length,
      };
    }
    return await dumpsService.listDumps(params);
  },
});

export const $dumpsStore = createInfiniteTableStore(domain, listDumpsFx);

sample({
  clock: dumpsViewMounted,
  fn: () => ({}),
  target: $dumpsStore.reset,
});

sample({
  clock: dumpsViewMounted,
  fn: () => ({}),
  target: $dumpsStore.loadMore,
});

sample({
  clock: refreshDumpsClicked,
  fn: () => ({}),
  target: $dumpsStore.reset,
});

sample({
  clock: refreshDumpsClicked,
  fn: () => ({}),
  target: $dumpsStore.loadMore,
});

export default domain;
