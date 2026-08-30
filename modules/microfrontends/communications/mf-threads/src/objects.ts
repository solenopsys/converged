import {
	defineMicrofrontend,
	objectOf,
	setOf,
} from "front-core/object-runtime";
import { ThreadsStatsView } from "./views/ThreadsStatsView";
import { ThreadsView } from "./views/ThreadsView";

export default defineMicrofrontend({
	id: "mf-threads",
	types: [
		{
			id: "threads.thread",
			label: "Thread",
			pluralLabel: "Threads",
			categories: ["core.communication", "core.selectable"],
		},
		{
			id: "threads.statistic",
			label: "Thread statistic",
			pluralLabel: "Thread statistics",
			categories: ["core.statistic", "core.communication"],
		},
	],
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
