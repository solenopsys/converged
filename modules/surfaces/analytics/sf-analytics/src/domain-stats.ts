import { createEffect, createEvent, createStore, sample } from "effector";
import type {
	AnalyticsDashboardSummary,
	AnalyticsStatistic,
} from "g-analytics";
import analytics from "./service";

const emptySummary: AnalyticsDashboardSummary = {
	page_views_today: 0,
	visits_today: 0,
	visitors_today: 0,
	events_total: 0,
	active_sessions: 0,
	active_visitors: 0,
	active_pages: [],
	page_views_by_uri: [],
	active_countries: [],
	updated_at: 0,
};

const emptyStatistic: AnalyticsStatistic = {
	totalHot: 0,
	totalCold: 0,
	byEvent: {},
	dashboard: emptySummary,
	timeline: [],
	visitorTypes: { human: 0, bot: 0, unverified: 0 },
	geoLiteDatabases: [],
};

export const dashboardMounted = createEvent();
export const realtimeMounted = createEvent();
export const refreshAnalyticsClicked = createEvent();
export const pollRealtimeRequested = createEvent();

export const loadAnalyticsSummaryFx = createEffect(async () =>
	analytics.getDashboardSummary(),
);

export const loadAnalyticsStatisticFx = createEffect(async () =>
	analytics.getStatistic(),
);

export const $analyticsSummary = createStore(emptySummary)
	.on(loadAnalyticsSummaryFx.doneData, (_, summary) => summary)
	.on(loadAnalyticsStatisticFx.doneData, (_, statistic) => statistic.dashboard);

export const $analyticsStatistic = createStore(emptyStatistic).on(
	loadAnalyticsStatisticFx.doneData,
	(_, statistic) => statistic,
);

sample({
	clock: [realtimeMounted, refreshAnalyticsClicked, pollRealtimeRequested],
	target: loadAnalyticsSummaryFx,
});

sample({
	clock: [dashboardMounted, refreshAnalyticsClicked],
	target: loadAnalyticsStatisticFx,
});
