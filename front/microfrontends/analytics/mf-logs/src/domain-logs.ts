import { createDomain, sample } from 'effector';
import { createInfiniteTableStore } from 'front-core';
import logsService from './service';
import { PaginationParams } from './functions/types';

const domain = createDomain('logs');

export type LogsMode = 'hot' | 'cold';

export const logsViewMounted = domain.createEvent<{ mode: LogsMode }>('LOGS_VIEW_MOUNTED');
export const refreshLogsClicked = domain.createEvent('REFRESH_LOGS_CLICKED');

const $logsMode = domain.createStore<LogsMode>('hot');

$logsMode.on(logsViewMounted, (_state, payload) => payload.mode);

const listLogsFx = domain.createEffect<PaginationParams, any>({
  name: 'LIST_LOGS',
  handler: async (params: PaginationParams) => {
    const mode = $logsMode.getState();
    return mode === 'cold'
      ? await logsService.listCold(params)
      : await logsService.listHot(params);
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
