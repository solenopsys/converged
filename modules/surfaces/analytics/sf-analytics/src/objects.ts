import { EntityListView } from "front-core";
import {
	defineSurface,
	objectOf,
	objectRef,
	setOf,
} from "front-core/object-runtime";
import type { AnalyticsQueryParams } from "g-analytics";
import {
	analyticsColumns,
	analyticsIpSessionColumns,
} from "./functions/columns";
import analytics from "./service";
import { geoLiteStore } from "./domain-geolite";
import { geoLiteColumns } from "./functions/geolite-columns";
import { AnalyticsSummary } from "./summary";
import { AnalyticsDashboardView } from "./views/AnalyticsDashboardView";
import { AnalyticsRealtimeView } from "./views/AnalyticsRealtimeView";
import { GeoDatabasesView } from "./views/GeoDatabasesView";
import { AnalyticsSessionEventsView } from "./views/AnalyticsSessionEventsView";

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
			infinity: {
				tableId: "analytics-geolite-databases",
				title: "IP databases",
				columns: geoLiteColumns,
				store: geoLiteStore,
				presets: [
					{
						id: "analytics.geolite.country",
						label: "Country",
						control: "tab",
						group: "analytics-geolite-dataset",
					},
					{
						id: "analytics.geolite.city",
						label: "City",
						control: "tab",
						group: "analytics-geolite-dataset",
					},
					{
						id: "analytics.geolite.asn",
						label: "ASN",
						control: "tab",
						group: "analytics-geolite-dataset",
					},
				],
			},
		},
		{
			id: "analytics.ip-sessions",
			label: "IP activity",
			pluralLabel: "IP sessions",
			categories: ["core.entity"],
			infinity: {
				tableId: "analytics-ip-sessions",
				title: "IP activity",
				columns: analyticsIpSessionColumns,
				rowRef: (row) => {
					const id = `${String(row.visitor_id)}:${String(row.session_id)}`;
					return objectRef("analytics.ip-sessions", id, {
						title: String(row.session_id),
						data: row,
					});
				},

				filters: [
					{
						id: "ip_address",
						label: "IP address",
						type: "search",
						operator: "contains",
					},
					{
						id: "network",
						label: "Network",
						type: "search",
						operator: "contains",
					},
					{
						id: "country_name",
						label: "Country",
						type: "search",
						operator: "contains",
					},
					{
						id: "city_name",
						label: "City",
						type: "search",
						operator: "contains",
					},
					{
						id: "user_type",
						label: "Visitor type",
						type: "select",
						operator: "eq",
						options: [
							{ value: "human", label: "Human" },
							{ value: "bot", label: "Bot" },
							{ value: "unverified", label: "Unverified" },
						],
					},
					{
						id: "device_type",
						label: "Device",
						type: "select",
						operator: "eq",
						options: [
							{ value: "mobile", label: "Mobile" },
							{ value: "tablet", label: "Tablet" },
							{ value: "desktop", label: "Desktop" },
							{ value: "unknown", label: "Unknown" },
						],
					},
					{
						id: "screen",
						label: "Screen",
						type: "search",
						operator: "contains",
					},
					{
						id: "url",
						label: "Page",
						type: "search",
						operator: "contains",
					},
					{
						id: "utm_source",
						label: "Traffic source",
						type: "search",
						operator: "contains",
					},
				],
				presets: [
					{
						id: "analytics.sessions.humans",
						label: "Humans",
						control: "tab",
						group: "analytics-session-type",
					},
					{
						id: "analytics.sessions.bots",
						label: "Bots",
						control: "tab",
						group: "analytics-session-type",
					},
					{
						id: "analytics.sessions.all",
						label: "All",
						control: "tab",
						group: "analytics-session-type",
					},
				],
				load: (params) => {
					const presetFilter = hasPreset(params, "analytics.sessions.bots")
						? { user_type: { eq: "bot" } }
						: hasPreset(params, "analytics.sessions.all")
							? undefined
							: { user_type: { eq: "human" } };
					const activeFilters = params.filter as
						| Record<string, unknown>
						| undefined;
					const filter = presetFilter
						? activeFilters
							? { AND: [presetFilter, activeFilters] }
							: presetFilter
						: activeFilters;
					return analytics.listIpSessions(
						Number(params.limit ?? 20),
						Number(params.offset ?? 0),
						filter,
					);
				},
			},
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
			component: EntityListView,
		},
		{
			id: "analytics.ip-session.events",
			label: "Session events",
			accepts: objectOf("analytics.ip-sessions"),
			component: AnalyticsSessionEventsView,
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
