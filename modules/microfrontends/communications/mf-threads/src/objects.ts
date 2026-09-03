import {
	Category,
	defineMicrofrontend,
	type ObjectDefinition,
	objectOf,
	setOf,
} from "front-core/object-runtime";
import { threadsClient } from "./services";
import { ThreadsSummary } from "./summary";
import { ThreadsListView } from "./views/ThreadsListView";
import { ThreadsStatsView } from "./views/ThreadsStatsView";
import { ThreadsView } from "./views/ThreadsView";

export const objects = [
	{
		id: "threads.thread",
		label: "Thread",
		pluralLabel: "Threads",
		categories: [Category.Communication, Category.Selectable],
		selection: {
			filters: [],
			describe: () => threadsClient.describeSelection("threads.thread"),
			load: (params) => threadsClient.listThreads(params),
			inspect: (filter) => threadsClient.inspectThreads(filter),
		},
	},
	{
		id: "threads.statistic.summary",
		label: "Threads",
		categories: ["core.statistic"],
		statistic: {
			role: "summary",
			component: ThreadsSummary,
			actions: {
				title: "threads.show",
				metrics: {
					Threads: "threads.show",
					Messages: "threads.show",
					Chat: "threads.show",
					Audio: "threads.show",
					Forum: "threads.show",
				},
			},
		},
	},
	{
		id: "threads.statistic",
		label: "Thread statistic",
		pluralLabel: "Thread statistics",
		categories: [Category.Statistic, Category.Communication],
	},
] satisfies readonly ObjectDefinition[];

export default defineMicrofrontend({
	id: "mf-threads",
	types: objects,
	views: [
		{
			id: "threads.thread.detail",
			accepts: objectOf("threads.thread"),
			component: ThreadsView,
			props: (ref) => ({
				threadId: ref.kind === "object" ? ref.id : undefined,
				variant: "thread" as const,
			}),
		},
		{
			id: "threads.thread.table",
			accepts: setOf("threads.thread"),
			component: ThreadsListView,
		},
		{
			id: "threads.statistic.dashboard",
			accepts: setOf("threads.statistic"),
			component: ThreadsStatsView,
		},
	],
	operations: [],
});
