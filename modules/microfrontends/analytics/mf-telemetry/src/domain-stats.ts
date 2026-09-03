import { createEffect, createEvent, createStore, sample } from "effector";
import type { TelemetryStatistic } from "g-telemetry";
import type { TelemetryEvent } from "./functions/types";
import telemetryService from "./service";

const TELEMETRY_HOT_CHART_LIMIT = 2000;

export const telemetryStatsViewMounted = createEvent();
export const telemetryTitleStatsViewMounted = createEvent();
export const refreshTelemetryStatsClicked = createEvent();

export const fetchTelemetryStatsFx = createEffect(async () => {
	return telemetryService.getStatistic();
});

export const fetchTelemetryTitleStatsFx = createEffect(async () => {
	return telemetryService.getStatistic(["title"]);
});

export const fetchTelemetryHotChartFx = createEffect(
	async (): Promise<TelemetryEvent[]> => {
		const result = await telemetryService.listHot({
			offset: 0,
			limit: TELEMETRY_HOT_CHART_LIMIT,
		});
		return result.items ?? [];
	},
);

export const $telemetryStats = createStore<TelemetryStatistic>({
	totalHot: 0,
	totalCold: 0,
	byDevice: {},
	byParam: {},
}).on(fetchTelemetryStatsFx.doneData, (_, stats) => stats);

$telemetryStats.on(fetchTelemetryTitleStatsFx.doneData, (_, stats) => stats);

export const $telemetryHotChartEvents = createStore<TelemetryEvent[]>([]).on(
	fetchTelemetryHotChartFx.doneData,
	(_, items) => items,
);

sample({
	clock: [telemetryStatsViewMounted, refreshTelemetryStatsClicked],
	target: fetchTelemetryStatsFx,
});

sample({
	clock: telemetryTitleStatsViewMounted,
	target: fetchTelemetryTitleStatsFx,
});

sample({
	clock: [telemetryStatsViewMounted, refreshTelemetryStatsClicked],
	target: fetchTelemetryHotChartFx,
});
