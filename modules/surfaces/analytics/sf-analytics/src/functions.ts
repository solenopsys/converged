import type { CreateAction } from "front-core";
import { presentReference, setRef } from "front-core/object-runtime";

export const SHOW_ANALYTICS_EVENTS = "analytics.events.show";
export const SHOW_ANALYTICS_DASHBOARD = "analytics.dashboard.show";
export const SHOW_ANALYTICS_REALTIME = "analytics.realtime.show";

const createShowEventsAction: CreateAction = () => ({
	id: SHOW_ANALYTICS_EVENTS,
	capability: "analytics/listHot(r)",
	invoke: () => {
		void presentReference(setRef("analytics.event", { kind: "query" }));
		return { ok: true, entity: "analytics", mode: "events" };
	},
});

const createShowDashboardAction: CreateAction = () => ({
	id: SHOW_ANALYTICS_DASHBOARD,
	capability: "analytics/getDashboardSummary(r)",
	invoke: () => {
		void presentReference(setRef("analytics.statistic", { kind: "query" }));
		return { ok: true, entity: "analytics", mode: "dashboard" };
	},
});

const createShowRealtimeAction: CreateAction = () => ({
	id: SHOW_ANALYTICS_REALTIME,
	capability: "analytics/getDashboardSummary(r)",
	invoke: () => {
		void presentReference(setRef("analytics.realtime", { kind: "query" }));
		return { ok: true, entity: "analytics", mode: "realtime" };
	},
});

export default [
	createShowDashboardAction,
	createShowRealtimeAction,
	createShowEventsAction,
];
