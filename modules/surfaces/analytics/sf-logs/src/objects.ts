import { EntityListView } from "front-core";
import { defineSurface, objectRef, setOf } from "front-core/object-runtime";
import type { LogQueryParams } from "g-logs";
import { logsColumns } from "./functions/columns";
import logs from "./service";
import { LogsSummary } from "./summary";
import { LogsStatsView } from "./views/LogsStatsView";

const hasPreset = (params: Record<string, unknown>, id: string) =>
	Array.isArray(params.presets) &&
	params.presets.some(
		(preset) =>
			typeof preset === "object" &&
			preset !== null &&
			(preset as { id?: unknown }).id === id,
	);

export default defineSurface({
	id: "sf-logs",
	label: "Logs",
	purpose: "Application log entries, hot and cold, and log statistics",
	types: [
		{
			id: "logs.entry",
			label: "Log entry",
			pluralLabel: "Logs",
			categories: ["core.entity", "core.selectable"],
			selection: {
				filters: [],
				describe: () => logs.describeSelection("logs.entry"),
				load: (params) => logs.listHot(params),
				inspect: (filter) => logs.inspectLogs(filter),
			},
			infinity: {
				tableId: "logs",
				title: "Logs",
				columns: logsColumns,
				load: (params) =>
					hasPreset(params, "logs.cold")
						? logs.listCold(params as LogQueryParams)
						: logs.listHot(params as LogQueryParams),
				rowRef: (row) =>
					objectRef(
						"logs.entry",
						`${String(row.ts)}:${String(row.source)}:${String(row.code)}`,
					),
				filters: [
					{
						id: "source",
						label: "Source",
						type: "search",
						operator: "contains",
					},
					{
						id: "level",
						label: "Level",
						type: "search",
						operator: "eq",
						valueType: "number",
					},
					{
						id: "code",
						label: "Code",
						type: "search",
						operator: "eq",
						valueType: "number",
					},
					{
						id: "message",
						label: "Message",
						type: "search",
						operator: "contains",
					},
				],
				presets: [
					{
						id: "logs.hot",
						label: "Hot",
						control: "tab",
						group: "logs-storage",
					},
					{
						id: "logs.cold",
						label: "Cold",
						control: "tab",
						group: "logs-storage",
					},
				],
			},
		},
		{
			id: "logs.statistic.summary",
			label: "Logs",
			categories: ["core.statistic"],
			statistic: {
				role: "summary",
				component: LogsSummary,
				actions: {
					title: "logs.stats.show",
					metrics: {
						Hot: "logs.hot.show",
						Cold: "logs.cold.show",
						Errors: "logs.stats.show",
						Warnings: "logs.stats.show",
					},
				},
			},
		},
		{
			id: "logs.statistic",
			label: "Log statistic",
			pluralLabel: "Log statistics",
			categories: ["core.statistic"],
		},
	],
	views: [
		{
			id: "logs.entry.table",
			label: "Logs",
			accepts: setOf("logs.entry"),
			component: EntityListView,
		},
		{
			id: "logs.statistic.dashboard",
			label: "Log statistics",
			accepts: setOf("logs.statistic"),
			component: LogsStatsView,
		},
	],
	operations: [],
});
