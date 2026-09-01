import { defineMicrofrontend, setOf } from "front-core/object-runtime";
import logs from "./service";
import { LogsStatsView } from "./views/LogsStatsView";
import { LogsView } from "./views/LogsView";

export default defineMicrofrontend({
	id: "mf-logs",
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
			id: "logs.entry.hot",
			accepts: setOf("logs.entry"),
			component: LogsView,
			props: () => ({ mode: "hot" }),
		},
		{
			id: "logs.entry.cold",
			accepts: setOf("logs.entry"),
			component: LogsView,
			props: () => ({ mode: "cold" }),
			priority: -1,
		},
		{
			id: "logs.statistic.dashboard",
			accepts: setOf("logs.statistic"),
			component: LogsStatsView,
		},
	],
	operations: [],
});
