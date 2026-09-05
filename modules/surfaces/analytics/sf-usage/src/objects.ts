import { EntityListView } from "front-core";
import { defineSurface, objectRef, setOf } from "front-core/object-runtime";
import type { UsageListParams } from "g-usage";
import { usageColumns } from "./functions/columns";
import usage from "./service";
import { UsageSummary } from "./summary";
import { UsageStatsView } from "./views/UsageStatsView";

export default defineSurface({
	id: "sf-usage",
	label: "Usage",
	purpose: "Consumption records per tenant: what was used and how much",
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
			infinity: {
				tableId: "usage",
				title: "Usage events",
				columns: usageColumns,
				load: (params) => usage.listUsage(params as UsageListParams),
				rowRef: (row) => objectRef("usage.record", String(row.id)),
				filters: [
					{
						id: "function",
						label: "Function",
						type: "search",
						operator: "contains",
					},
					{
						id: "user",
						label: "User",
						type: "search",
						operator: "contains",
					},
					{
						id: "date",
						label: "Date",
						type: "date-range",
						operator: "between",
						valueType: "date",
					},
				],
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
			component: EntityListView,
		},
		{
			id: "usage.statistic.dashboard",
			accepts: setOf("usage.statistic"),
			component: UsageStatsView,
		},
	],
	operations: [],
});
