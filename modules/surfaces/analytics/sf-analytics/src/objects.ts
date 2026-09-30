import { EntityListView } from "front-core";
import { defineSurface, objectRef, setOf } from "front-core/object-runtime";
import type { AnalyticsQueryParams } from "g-analytics";
import { analyticsColumns } from "./functions/columns";
import analytics from "./service";
import { AnalyticsSummary } from "./summary";
import { AnalyticsDashboardView } from "./views/AnalyticsDashboardView";
import { AnalyticsIpSessionsView } from "./views/AnalyticsIpSessionsView";
import { AnalyticsRealtimeView } from "./views/AnalyticsRealtimeView";
import { GeoDatabasesView } from "./views/GeoDatabasesView";

const hasPreset = (params: Record<string, unknown>, id: string) =>
	Array.isArray(params.presets) &&
	params.presets.some(
		(preset) =>
			typeof preset === "object" &&
			preset !== null &&
			(preset as { id?: unknown }).id === id,
	);

export default defineSurface({
	id: "sf-analytics",
	label: "Analytics",
	purpose: "Website visits, active pages, visitor locations and browser events",
	types: [
		{
			id: "analytics.event",
			label: "Analytics event",
			pluralLabel: "Analytics events",
			categories: ["core.entity", "core.selectable"],
			selection: {
				filters: [],
				describe: () => analytics.describeSelection("analytics.event"),
				load: (params) => analytics.listHot(params as AnalyticsQueryParams),
				inspect: (filter) => analytics.inspectEvents(filter),
			},
			infinity: {
				tableId: "analytics-events",
				title: "Events",
				columns: analyticsColumns,
				load: (params) =>
					hasPreset(params, "analytics.cold")
						? analytics.listCold(params as AnalyticsQueryParams)
						: analytics.listHot(params as AnalyticsQueryParams),
				rowRef: (row) =>
					objectRef(
						"analytics.event",
						`${String(row.ts)}:${String(row.session_id)}:${String(row.event_type)}:${String(row.url)}`,
					),
				filters: [
					{ id: "event_type", label: "Event", type: "search", operator: "eq" },
					{ id: "url", label: "Page", type: "search", operator: "contains" },
					{
						id: "visitor_id",
						label: "Visitor",
						type: "search",
						operator: "eq",
					},
					{
						id: "session_id",
						label: "Session",
						type: "search",
						operator: "eq",
					},
				],
				presets: [
					{
						id: "analytics.hot",
						label: "Recent",
						control: "tab",
						group: "analytics-storage",
					},
					{
						id: "analytics.cold",
						label: "Archived",
						control: "tab",
						group: "analytics-storage",
					},
				],
			},
		},
		{
			id: "analytics.statistic.summary",
			label: "Analytics",
			categories: ["core.statistic"],
			statistic: {
				role: "summary",
				component: AnalyticsSummary,
				actions: {
					title: "analytics.dashboard.show",
					metrics: {
						Visits: "analytics.dashboard.show",
						Visitors: "analytics.dashboard.show",
						"Page views": "analytics.dashboard.show",
						"Active now": "analytics.realtime.show",
					},
				},
			},
		},
		{
			id: "analytics.statistic",
			label: "Analytics statistic",
			pluralLabel: "Analytics statistics",
			categories: ["core.statistic"],
		},
		{
			id: "analytics.realtime",
			label: "Realtime analytics",
			categories: ["core.statistic"],
		},
		{
			id: "analytics.geodatabase",
			label: "IP databases",
			categories: ["core.statistic"],
		},
		{
			id: "analytics.ip-sessions",
			label: "IP activity",
			categories: ["core.statistic"],
		},
	],
	views: [
		{
			id: "analytics.event.table",
			label: "Events",
			accepts: setOf("analytics.event"),
			component: EntityListView,
		},
		{
			id: "analytics.statistic.dashboard",
			label: "Dashboard",
			accepts: setOf("analytics.statistic"),
			component: AnalyticsDashboardView,
		},
		{
			id: "analytics.realtime.panel",
			label: "Realtime",
			accepts: setOf("analytics.realtime"),
			component: AnalyticsRealtimeView,
		},
		{
			id: "analytics.geodatabase.panel",
			label: "IP databases",
			accepts: setOf("analytics.geodatabase"),
			component: GeoDatabasesView,
		},
		{
			id: "analytics.ip-sessions.panel",
			label: "IP activity",
			accepts: setOf("analytics.ip-sessions"),
			component: AnalyticsIpSessionsView,
		},
	],
	operations: [],
	menu: [
		{ view: "analytics.statistic.dashboard", default: true },
		{ view: "analytics.realtime.panel" },
		{ view: "analytics.geodatabase.panel" },
		{ view: "analytics.ip-sessions.panel" },
		{ view: "analytics.event.table" },
	],
});
