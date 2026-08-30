import { defineMicrofrontend, setOf } from "front-core/object-runtime";
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
