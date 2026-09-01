import { defineMicrofrontend, setOf } from "front-core/object-runtime";
import usage from "./service";
import { UsageListView } from "./views/UsageListView";
import { UsageStatsView } from "./views/UsageStatsView";

export default defineMicrofrontend({
	id: "mf-usage",
	types: [
		{
			id: "usage.record",
			label: "Usage record",
			pluralLabel: "Usage",
			categories: ["core.entity", "core.selectable"],
			selection: {
				filters: [],
				describe: () => usage.describeSelection("usage.record"),
				load: (params) => usage.listUsage(params),
				inspect: (filter) => usage.inspectUsage(filter),
			},
		},
		{
			id: "usage.statistic",
			label: "Usage statistic",
			pluralLabel: "Usage statistics",
			categories: ["core.statistic"],
		},
	],
	views: [
		{
			id: "usage.record.table",
			accepts: setOf("usage.record"),
			component: UsageListView,
		},
		{
			id: "usage.statistic.dashboard",
			accepts: setOf("usage.statistic"),
			component: UsageStatsView,
		},
	],
	operations: [],
});
