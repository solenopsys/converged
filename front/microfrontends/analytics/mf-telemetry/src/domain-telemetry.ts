import { createDomain, createStore, sample } from 'effector';
import { createInfiniteTableStore } from 'front-core';
import telemetryService from './service';
import { PaginationParams } from './functions/types';

export type TelemetryMode = 'hot' | 'cold';

const domain = createDomain('telemetry');

export const telemetryViewMounted = domain.createEvent<TelemetryMode>('TELEMETRY_VIEW_MOUNTED');
export const refreshTelemetryClicked = domain.createEvent('REFRESH_TELEMETRY_CLICKED');
export const telemetryModeChanged = domain.createEvent<TelemetryMode>('TELEMETRY_MODE_CHANGED');

export const $telemetryMode = createStore<TelemetryMode>('hot')
  .on(telemetryViewMounted, (_, mode) => mode)
  .on(telemetryModeChanged, (_, mode) => mode);

const listTelemetryHotFx = domain.createEffect<PaginationParams, any>({
  name: 'LIST_TELEMETRY_HOT',
  handler: async (params: PaginationParams) => {
    return await telemetryService.listHot(params);
  },
});

const listTelemetryColdFx = domain.createEffect<PaginationParams, any>({
  name: 'LIST_TELEMETRY_COLD',
  handler: async (params: PaginationParams) => {
    return await telemetryService.listCold(params);
  },
});

export const $telemetryHotStore = createInfiniteTableStore(domain, listTelemetryHotFx);
export const $telemetryColdStore = createInfiniteTableStore(domain, listTelemetryColdFx);

sample({
  clock: telemetryViewMounted,
  filter: (mode) => mode === 'hot',
  target: $telemetryHotStore.reset,
});
sample({
  clock: telemetryViewMounted,
  filter: (mode) => mode === 'hot',
  target: $telemetryHotStore.loadMore,
});
sample({
  clock: telemetryViewMounted,
  filter: (mode) => mode === 'cold',
  target: $telemetryColdStore.reset,
});
sample({
  clock: telemetryViewMounted,
  filter: (mode) => mode === 'cold',
  target: $telemetryColdStore.loadMore,
});

sample({
  clock: telemetryModeChanged,
  filter: (mode) => mode === 'hot',
  target: $telemetryHotStore.reset,
});
sample({
  clock: telemetryModeChanged,
  filter: (mode) => mode === 'hot',
  target: $telemetryHotStore.loadMore,
});
sample({
  clock: telemetryModeChanged,
  filter: (mode) => mode === 'cold',
  target: $telemetryColdStore.reset,
});
sample({
  clock: telemetryModeChanged,
  filter: (mode) => mode === 'cold',
  target: $telemetryColdStore.loadMore,
});

sample({
  clock: refreshTelemetryClicked,
  source: $telemetryMode,
  filter: (mode) => mode === 'hot',
  target: $telemetryHotStore.reset,
});
sample({
  clock: refreshTelemetryClicked,
  source: $telemetryMode,
  filter: (mode) => mode === 'hot',
  target: $telemetryHotStore.loadMore,
});
sample({
  clock: refreshTelemetryClicked,
  source: $telemetryMode,
  filter: (mode) => mode === 'cold',
  target: $telemetryColdStore.reset,
});
sample({
  clock: refreshTelemetryClicked,
  source: $telemetryMode,
  filter: (mode) => mode === 'cold',
  target: $telemetryColdStore.loadMore,
});

export default domain;
