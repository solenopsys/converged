import { EntityListView } from "front-core";
import { defineSurface, setOf, setRef } from "front-core/object-runtime";
import type { TelemetryQueryParams } from "g-telemetry";
import { telemetryColumns } from "./functions/columns";
import telemetry from "./service";
import { TelemetrySummary } from "./summary";
import { TelemetryStatsView } from "./views/TelemetryStatsView";

const hasPreset = (params: Record<string, unknown>, id: string) =>
	Array.isArray(params.presets) &&
	params.presets.some(
		(preset) =>
			typeof preset === "object" &&
			preset !== null &&
			(preset as { id?: unknown }).id === id,
	);

export default defineSurface({
	id: "sf-telemetry",
	label: "Telemetry",
	purpose: "Service telemetry: timings, volumes and error rates",
	types: [
		{
			id: "telemetry.entry",
			label: "Telemetry entry",
			pluralLabel: "Telemetry",
			categories: ["core.entity", "core.selectable"],
			selection: {
				filters: [],
				describe: () => telemetry.describeSelection("telemetry.entry"),
				load: (params) => telemetry.listHot(params),
				inspect: (filter) => telemetry.inspectTelemetry(filter),
			},
			infinity: {
				tableId: "telemetry",
				title: "Telemetry",
				columns: telemetryColumns,
				load: (params) =>
					hasPreset(params, "telemetry.cold")
						? telemetry.listCold(params as TelemetryQueryParams)
						: telemetry.listHot(params as TelemetryQueryParams),
				// A sample has no card of its own; the thing worth opening is the
				// machine that sent it. The ref names `equipment.machine` and nothing
				// else — whichever surface owns that type opens its table narrowed to
				// this device key, and this one never imports it.
				rowRef: (row) =>
					setRef(
						"equipment.machine",
						{
							kind: "query",
							filter: { deviceId: { eq: String(row.device_id ?? "") } },
						},
						{ title: String(row.device_id ?? "") },
					),
				filters: [
					{
						id: "deviceId",
						label: "Device",
						type: "search",
						operator: "contains",
					},
					{
						id: "param",
						label: "Param",
						type: "search",
						operator: "contains",
					},
					{
						id: "value",
						label: "Value",
						type: "search",
						operator: "eq",
						valueType: "number",
					},
				],
				presets: [
					{
						id: "telemetry.hot",
						label: "Hot",
						control: "tab",
						group: "telemetry-storage",
					},
					{
						id: "telemetry.cold",
						label: "Cold",
						control: "tab",
						group: "telemetry-storage",
					},
				],
			},
		},
		{
			id: "telemetry.statistic.summary",
			label: "Telemetry",
			categories: ["core.statistic"],
			statistic: {
				role: "summary",
				component: TelemetrySummary,
				actions: {
					title: "telemetry.stats.show",
					metrics: {
						Hot: "telemetry.hot.show",
						Cold: "telemetry.cold.show",
						Devices: "telemetry.stats.show",
						Parameters: "telemetry.stats.show",
					},
				},
			},
		},
		{
			id: "telemetry.statistic",
			label: "Telemetry statistic",
			pluralLabel: "Telemetry statistics",
			categories: ["core.statistic"],
		},
	],
	views: [
		{
			id: "telemetry.entry.table",
			label: "Telemetry",
			accepts: setOf("telemetry.entry"),
			component: EntityListView,
		},
		{
			id: "telemetry.statistic.dashboard",
			label: "Telemetry statistics",
			accepts: setOf("telemetry.statistic"),
			component: TelemetryStatsView,
		},
	],
	operations: [],
});
