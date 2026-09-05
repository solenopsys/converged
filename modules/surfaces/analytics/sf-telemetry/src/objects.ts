import { defineSurface, setOf } from "front-core/object-runtime";
import telemetry from "./service";
import { TelemetrySummary } from "./summary";
import { TelemetryStatsView } from "./views/TelemetryStatsView";
import { TelemetryView } from "./views/TelemetryView";

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
			id: "telemetry.entry.hot",
			accepts: setOf("telemetry.entry"),
			component: TelemetryView,
			props: () => ({ mode: "hot" }),
		},
		{
			id: "telemetry.entry.cold",
			accepts: setOf("telemetry.entry"),
			component: TelemetryView,
			props: () => ({ mode: "cold" }),
			priority: -1,
		},
		{
			id: "telemetry.statistic.dashboard",
			accepts: setOf("telemetry.statistic"),
			component: TelemetryStatsView,
		},
	],
	operations: [],
});
