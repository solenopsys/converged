import { createDomain, sample } from 'effector';
import { createInfiniteTableStore } from 'front-core';
import telemetryService from './service';
import { PaginationParams } from './functions/types';

const domain = createDomain('telemetry');

export type TelemetryMode = 'hot' | 'cold';

export const telemetryViewMounted = domain.createEvent<{ mode: TelemetryMode }>(
  'TELEMETRY_VIEW_MOUNTED',
);
export const refreshTelemetryClicked = domain.createEvent('REFRESH_TELEMETRY_CLICKED');

const $telemetryMode = domain.createStore<TelemetryMode>('hot');

$telemetryMode.on(telemetryViewMounted, (_state, payload) => payload.mode);

const listTelemetryFx = domain.createEffect<PaginationParams, any>({
  name: 'LIST_TELEMETRY',
  handler: async (params: PaginationParams) => {
    const mode = $telemetryMode.getState();
    return mode === 'cold'
      ? await telemetryService.listCold(params)
      : await telemetryService.listHot(params);
  },
});

export const $telemetryStore = createInfiniteTableStore(domain, listTelemetryFx);

sample({
  clock: telemetryViewMounted,
  fn: () => ({}),
  target: $telemetryStore.reset,
});

sample({
  clock: telemetryViewMounted,
  fn: () => ({}),
  target: $telemetryStore.loadMore,
});

sample({
  clock: refreshTelemetryClicked,
  fn: () => ({}),
  target: $telemetryStore.reset,
});

sample({
  clock: refreshTelemetryClicked,
  fn: () => ({}),
  target: $telemetryStore.loadMore,
});

export default domain;
