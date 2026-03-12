import { createStore, createEvent, createEffect, sample } from "effector";
import logsClient from "./service";
import type { LogsStatistic } from "g-logs";

export const logsStatsViewMounted = createEvent();
export const refreshLogsStatsClicked = createEvent();

export const fetchLogsStatsFx = createEffect(async () => {
  return logsClient.getStatistic();
});

export const $logsStats = createStore<LogsStatistic>({
  totalHot: 0,
  totalCold: 0,
  byLevel: {},
  bySource: {},
  errors: 0,
  warnings: 0,
}).on(fetchLogsStatsFx.doneData, (_, stats) => stats);

sample({
  clock: [logsStatsViewMounted, refreshLogsStatsClicked],
  target: fetchLogsStatsFx,
});
