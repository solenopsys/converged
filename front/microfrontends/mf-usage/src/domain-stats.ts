import { createDomain, sample } from "effector";
import usageService from "./service";
import type { UsageStatsParams, UsageDailyStatsItem, UsageTotalStats } from "g-usage";

const domain = createDomain("usage-stats");

export const usageStatsViewMounted = domain.createEvent<UsageStatsParams | void>(
  "USAGE_STATS_VIEW_MOUNTED",
);
export const refreshUsageStatsClicked = domain.createEvent("REFRESH_USAGE_STATS_CLICKED");

const loadDailyStatsFx = domain.createEffect<UsageStatsParams | void, UsageDailyStatsItem[]>({
  name: "LOAD_DAILY_USAGE_STATS",
  handler: async (params) => {
    return await usageService.getUsageDaily(params ?? {});
  },
});

const loadTotalStatsFx = domain.createEffect<UsageStatsParams | void, UsageTotalStats>({
  name: "LOAD_TOTAL_USAGE_STATS",
  handler: async (params) => {
    return await usageService.getUsageTotal(params ?? {});
  },
});

export const $dailyStats = domain
  .createStore<UsageDailyStatsItem[]>([])
  .on(loadDailyStatsFx.doneData, (_state, data) => data ?? []);

export const $totalStats = domain
  .createStore<number>(0)
  .on(loadTotalStatsFx.doneData, (_state, data) => data?.total ?? 0);

sample({
  clock: usageStatsViewMounted,
  target: loadDailyStatsFx,
});

sample({
  clock: usageStatsViewMounted,
  target: loadTotalStatsFx,
});

sample({
  clock: refreshUsageStatsClicked,
  fn: () => ({}),
  target: loadDailyStatsFx,
});

sample({
  clock: refreshUsageStatsClicked,
  fn: () => ({}),
  target: loadTotalStatsFx,
});

export default domain;
