import { EntityListView, Plus } from "front-core";
import type { SurfaceDefinition } from "front-core/object-runtime";
import { objectOf, objectRef, setOf } from "front-core/object-runtime";
import type {
	CronHistoryListParams,
	CronInput,
	CronListParams,
} from "g-sheduller";
import { addCronClicked, openCronForm } from "./domain-crons";
import { cronsColumns, historyColumns } from "./functions/columns";
import shedullerService from "./service";
import { ShedullerSummary } from "./summary";
import { CronFormView } from "./views/CronFormView";
import { StatsView } from "./views/StatsView";

export const shedullerContribution: Pick<
	SurfaceDefinition,
	"types" | "views" | "operations"
> = {
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
				actions: [
					{
						id: "add",
						label: "New schedule",
						icon: Plus,
						event: addCronClicked,
						variant: "default" as const,
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
			id: "scheduler.cron.detail",
			accepts: objectOf("scheduler.cron"),
			component: CronFormView,
			props: (ref) => {
				if (ref.kind === "object") loadCron(ref.id);
				return {};
			},
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
				const result = (await shedullerService.createCron(
					params as CronInput,
				)) as { id?: string | number } | undefined;
				return objectRef(
					"scheduler.cron",
					String(result?.id ?? params.id ?? crypto.randomUUID()),
				);
			},
		},
	],
};

/**
 * The list holds the row; the form wants the record, so fetch the one row.
 * `new` is not a row — it is how the header button asks for a blank form.
 */
async function loadCron(id: string): Promise<void> {
	if (id === "new") {
		openCronForm({ cron: null });
		return;
	}
	const result = await shedullerService.listCrons({
		offset: 0,
		limit: 1,
		filter: { id: { eq: id } },
	} as CronListParams);
	openCronForm({ cron: result?.items?.[0] ?? null });
}
