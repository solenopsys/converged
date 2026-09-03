import { createEffect, createEvent, createStore, sample } from "effector";
import type { LogsStatistic } from "g-logs";
import logsClient from "./service";

export const logsStatsViewMounted = createEvent();
export const logsTitleStatsViewMounted = createEvent();
export const refreshLogsStatsClicked = createEvent();

export const fetchLogsStatsFx = createEffect(async () => {
	return logsClient.getStatistic();
});

export const fetchLogsTitleStatsFx = createEffect(async () => {
	return logsClient.getStatistic(["title"]);
});

export const $logsStats = createStore<LogsStatistic>({
	totalHot: 0,
	totalCold: 0,
	byLevel: {},
	bySource: {},
	errors: 0,
	warnings: 0,
}).on(fetchLogsStatsFx.doneData, (_, stats) => stats);

$logsStats.on(fetchLogsTitleStatsFx.doneData, (_, stats) => stats);

sample({
	clock: [logsStatsViewMounted, refreshLogsStatsClicked],
	target: fetchLogsStatsFx,
});

sample({ clock: logsTitleStatsViewMounted, target: fetchLogsTitleStatsFx });
