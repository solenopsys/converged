import { createDomain, sample } from "effector";
import type {
	UsageDailyStatsItem,
	UsageFunctionStatsItem,
	UsageStatsParams,
	UsageTotalStats,
	UsageStatistic,
} from "g-usage";
import usageService from "./service";

const domain = createDomain("usage-stats");

export const usageStatsViewMounted =
	domain.createEvent<UsageStatsParams | void>("USAGE_STATS_VIEW_MOUNTED");
export const refreshUsageStatsClicked = domain.createEvent(
	"REFRESH_USAGE_STATS_CLICKED",
);
export const usageTitleStatsViewMounted = domain.createEvent(
	"USAGE_TITLE_STATS_VIEW_MOUNTED",
);

const loadTitleStatsFx = domain.createEffect<void, UsageStatistic>({
	name: "LOAD_USAGE_TITLE_STATS",
	handler: () => usageService.getStatistic(["title"]),
});

const loadDailyStatsFx = domain.createEffect<
	UsageStatsParams | void,
	UsageDailyStatsItem[]
>({
	name: "LOAD_DAILY_USAGE_STATS",
	handler: async (params) => {
		return await usageService.getUsageDaily(params ?? {});
	},
});

const loadTotalStatsFx = domain.createEffect<
	UsageStatsParams | void,
	UsageTotalStats
>({
	name: "LOAD_TOTAL_USAGE_STATS",
	handler: async (params) => {
		return await usageService.getUsageTotal(params ?? {});
	},
});

const loadFunctionStatsFx = domain.createEffect<
	UsageStatsParams | void,
	UsageFunctionStatsItem[]
>({
	name: "LOAD_FUNCTION_USAGE_STATS",
	handler: async (params) => {
		return await usageService.getUsageByFunction(params ?? {});
	},
});

export const $dailyStats = domain
	.createStore<UsageDailyStatsItem[]>([])
	.on(loadDailyStatsFx.doneData, (_state, data) => data ?? []);

export const $totalStats = domain
	.createStore<number>(0)
	.on(loadTotalStatsFx.doneData, (_state, data) => data?.total ?? 0);

export const $functionStats = domain
	.createStore<UsageFunctionStatsItem[]>([])
	.on(loadFunctionStatsFx.doneData, (_state, data) => data ?? []);
export const $functionCount = domain
	.createStore(0)
	.on(loadFunctionStatsFx.doneData, (_, data) => data?.length ?? 0)
	.on(loadTitleStatsFx.doneData, (_, stats) => stats.functions);

$totalStats.on(loadTitleStatsFx.doneData, (_, stats) => stats.total);
$dailyStats.on(loadTitleStatsFx.doneData, (_, stats) => stats.daily);

sample({ clock: usageTitleStatsViewMounted, target: loadTitleStatsFx });

sample({
	clock: usageStatsViewMounted,
	target: [loadDailyStatsFx, loadTotalStatsFx, loadFunctionStatsFx],
});

sample({
	clock: refreshUsageStatsClicked,
	fn: () => ({}),
	target: [loadDailyStatsFx, loadTotalStatsFx, loadFunctionStatsFx],
});

export default domain;
