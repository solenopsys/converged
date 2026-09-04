import { defineSurface, setOf } from "front-core/object-runtime";
import usage from "./service";
import { UsageSummary } from "./summary";
import { UsageListView } from "./views/UsageListView";
import { UsageStatsView } from "./views/UsageStatsView";

export default defineSurface({
	id: "sf-usage",
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
			id: "usage.statistic.summary",
			label: "Usage",
			categories: ["core.statistic"],
			statistic: {
				role: "summary",
				component: UsageSummary,
				actions: {
					title: "usage.list.show",
					metrics: { Calls: "usage.list.show", Functions: "usage.stats.show" },
				},
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
