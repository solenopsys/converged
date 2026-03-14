import { createStore, createEvent, createEffect, sample } from "effector";
import telemetryService from "./service";
import type { TelemetryStatistic } from "g-telemetry";

export const telemetryStatsViewMounted = createEvent();
export const refreshTelemetryStatsClicked = createEvent();

export const fetchTelemetryStatsFx = createEffect(async () => {
  return telemetryService.getStatistic();
});

export const $telemetryStats = createStore<TelemetryStatistic>({
  totalHot: 0,
  totalCold: 0,
  byDevice: {},
  byParam: {},
}).on(fetchTelemetryStatsFx.doneData, (_, stats) => stats);

sample({
  clock: [telemetryStatsViewMounted, refreshTelemetryStatsClicked],
  target: fetchTelemetryStatsFx,
});
