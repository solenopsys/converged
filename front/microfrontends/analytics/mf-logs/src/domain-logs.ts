import { createDomain, createStore, sample } from 'effector';
import { createInfiniteTableStore } from 'front-core';
import logsService from './service';
import { PaginationParams } from './functions/types';

export type LogsMode = 'hot' | 'cold';

const domain = createDomain('logs');

export const logsViewMounted = domain.createEvent<LogsMode>('LOGS_VIEW_MOUNTED');
export const refreshLogsClicked = domain.createEvent('REFRESH_LOGS_CLICKED');
export const logsModeChanged = domain.createEvent<LogsMode>('LOGS_MODE_CHANGED');

export const $logsMode = createStore<LogsMode>('hot')
  .on(logsViewMounted, (_, mode) => mode)
  .on(logsModeChanged, (_, mode) => mode);

const listLogsHotFx = domain.createEffect<PaginationParams, any>({
  name: 'LIST_LOGS_HOT',
  handler: async (params: PaginationParams) => {
    return await logsService.listHot(params);
  },
});

const listLogsColdFx = domain.createEffect<PaginationParams, any>({
  name: 'LIST_LOGS_COLD',
  handler: async (params: PaginationParams) => {
    return await logsService.listCold(params);
  },
});

export const $logsHotStore = createInfiniteTableStore(domain, listLogsHotFx);
export const $logsColdStore = createInfiniteTableStore(domain, listLogsColdFx);

sample({
  clock: logsViewMounted,
  filter: (mode) => mode === 'hot',
  target: $logsHotStore.reset,
});
sample({
  clock: logsViewMounted,
  filter: (mode) => mode === 'hot',
  target: $logsHotStore.loadMore,
});
sample({
  clock: logsViewMounted,
  filter: (mode) => mode === 'cold',
  target: $logsColdStore.reset,
});
sample({
  clock: logsViewMounted,
  filter: (mode) => mode === 'cold',
  target: $logsColdStore.loadMore,
});

sample({
  clock: logsModeChanged,
  filter: (mode) => mode === 'hot',
  target: $logsHotStore.reset,
});
sample({
  clock: logsModeChanged,
  filter: (mode) => mode === 'hot',
  target: $logsHotStore.loadMore,
});
sample({
  clock: logsModeChanged,
  filter: (mode) => mode === 'cold',
  target: $logsColdStore.reset,
});
sample({
  clock: logsModeChanged,
  filter: (mode) => mode === 'cold',
  target: $logsColdStore.loadMore,
});

sample({
  clock: refreshLogsClicked,
  source: $logsMode,
  filter: (mode) => mode === 'hot',
  target: $logsHotStore.reset,
});
sample({
  clock: refreshLogsClicked,
  source: $logsMode,
  filter: (mode) => mode === 'hot',
  target: $logsHotStore.loadMore,
});
sample({
  clock: refreshLogsClicked,
  source: $logsMode,
  filter: (mode) => mode === 'cold',
  target: $logsColdStore.reset,
});
sample({
  clock: refreshLogsClicked,
  source: $logsMode,
  filter: (mode) => mode === 'cold',
  target: $logsColdStore.loadMore,
});

export default domain;
