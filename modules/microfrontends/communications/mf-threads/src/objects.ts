import {
	Category,
	defineMicrofrontend,
	type ObjectDefinition,
	objectOf,
	setOf,
} from "front-core/object-runtime";
import { ThreadsStatsView } from "./views/ThreadsStatsView";
import { ThreadsView } from "./views/ThreadsView";

export const objects = [
	{
		id: "threads.thread",
		label: "Thread",
		pluralLabel: "Threads",
		categories: [Category.Communication, Category.Selectable],
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
			}),
		},
		{
			id: "threads.thread.table",
			accepts: setOf("threads.thread"),
			component: ThreadsView,
			props: (ref) => ({
				threadIds:
					ref.kind === "set" && ref.selection.kind === "ids"
						? ref.selection.ids
						: undefined,
			}),
		},
		{
			id: "threads.statistic.dashboard",
			accepts: setOf("threads.statistic"),
			component: ThreadsStatsView,
		},
	],
	operations: [],
});
