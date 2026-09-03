import {
	defineMicrofrontend,
	objectOf,
	objectRef,
	setOf,
} from "front-core/object-runtime";
import shedullerService from "./service";
import { ShedullerSummary } from "./summary";
import { CronsListView } from "./views/CronsListView";
import { HistoryView } from "./views/HistoryView";
import { StatsView } from "./views/StatsView";

export default defineMicrofrontend({
	id: "mf-sheduller",
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
			component: CronsListView,
		},
		{
			id: "scheduler.history.table",
			accepts: setOf("scheduler.history"),
			component: HistoryView,
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
