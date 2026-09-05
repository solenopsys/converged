import { EntityListView } from "front-core";
import {
	defineSurface,
	objectOf,
	objectRef,
	setOf,
} from "front-core/object-runtime";
import type { CronHistoryListParams, CronListParams } from "g-sheduller";
import { cronsColumns, historyColumns } from "./functions/columns";
import shedullerService from "./service";
import { ShedullerSummary } from "./summary";
import { StatsView } from "./views/StatsView";

export default defineSurface({
	id: "sf-sheduller",
	label: "Schedules",
	purpose: "Recurring jobs, their cron schedules and run history",
	types: [
		{
			id: "scheduler.cron",
			label: "Schedule",
			pluralLabel: "Schedules",
			categories: [
				"core.automation",
				"core.selectable",
				"core.creatable",
				"core.editable",
				"core.executable",
			],
			selection: {
				filters: [],
				describe: () => shedullerService.describeSelection("scheduler.cron"),
				load: (params) => shedullerService.listCrons(params),
				inspect: (filter) => shedullerService.inspectCrons(filter),
			},
			infinity: {
				tableId: "scheduler-crons",
				title: "Crons",
				columns: cronsColumns,
				load: (params) => shedullerService.listCrons(params as CronListParams),
				rowRef: (cron) =>
					objectRef("scheduler.cron", String(cron.id), {
						title: typeof cron.name === "string" ? cron.name : undefined,
					}),
				filters: [
					{ id: "name", label: "Name", type: "search", operator: "contains" },
					{ id: "provider", label: "Provider", type: "search", operator: "eq" },
					{ id: "action", label: "Action", type: "search", operator: "eq" },
					{
						id: "status",
						label: "Status",
						type: "select",
						operator: "eq",
						options: [
							{ value: "active", label: "Active" },
							{ value: "paused", label: "Paused" },
						],
					},
				],
			},
		},
		{
			id: "scheduler.history",
			label: "Schedule history",
			pluralLabel: "Schedule history",
			categories: ["core.automation", "core.selectable"],
			selection: {
				filters: [],
				describe: () => shedullerService.describeSelection("scheduler.history"),
				load: (params) => shedullerService.listHistory(params),
				inspect: (filter) => shedullerService.inspectHistory(filter),
			},
			infinity: {
				tableId: "scheduler-history",
				title: "History",
				columns: historyColumns,
				load: (params) =>
					shedullerService.listHistory(params as CronHistoryListParams),
				rowRef: (entry) => objectRef("scheduler.history", String(entry.id)),
				filters: [
					{ id: "cronId", label: "Schedule", type: "search", operator: "eq" },
					{ id: "provider", label: "Provider", type: "search", operator: "eq" },
					{ id: "action", label: "Action", type: "search", operator: "eq" },
					{
						id: "success",
						label: "Success",
						type: "select",
						operator: "eq",
						valueType: "boolean",
						options: [
							{ value: "true", label: "Success" },
							{ value: "false", label: "Failed" },
						],
					},
				],
			},
		},
		{
			id: "scheduler.statistic.summary",
			label: "Scheduler",
			categories: ["core.statistic", "core.automation"],
			statistic: { role: "summary", component: ShedullerSummary },
		},
		{
			id: "scheduler.statistic",
			label: "Scheduler statistic",
			pluralLabel: "Scheduler statistics",
			categories: ["core.statistic", "core.automation"],
		},
	],
	views: [
		{
			id: "scheduler.cron.table",
			accepts: setOf("scheduler.cron"),
			component: EntityListView,
		},
		{
			id: "scheduler.history.table",
			accepts: setOf("scheduler.history"),
			component: EntityListView,
		},
		{
			id: "scheduler.statistic.dashboard",
			accepts: setOf("scheduler.statistic"),
			component: StatsView,
		},
	],
	operations: [
		{
			id: "scheduler.cron.create",
			operator: "create",
			target: "scheduler.cron",
			label: "Create schedule",
			output: objectOf("scheduler.cron"),
			parameters: { type: "object", properties: {} },
			invoke: async ({ params }) => {
				const result = await shedullerService.createCron(params as any);
				return objectRef(
					"scheduler.cron",
					String((result as any)?.id ?? params.id ?? crypto.randomUUID()),
				);
			},
		},
	],
});
