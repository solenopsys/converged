import {
	SHOW_ANALYTICS_DASHBOARD,
	SHOW_ANALYTICS_EVENTS,
	SHOW_ANALYTICS_REALTIME,
} from "./functions";

export const MENU = {
	title: "menu.analytics",
	iconName: "IconChartHistogram",
	action: SHOW_ANALYTICS_DASHBOARD,
	items: [
		{
			title: "menu.analytics.realtime",
			key: "analytics-realtime",
			action: SHOW_ANALYTICS_REALTIME,
		},
		{
			title: "menu.analytics.events",
			key: "analytics-events",
			action: SHOW_ANALYTICS_EVENTS,
		},
	],
};
