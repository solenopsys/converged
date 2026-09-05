import { EntityListView } from "front-core";
import {
	Category,
	defineSurface,
	type ObjectDefinition,
	objectOf,
	objectRef,
	setOf,
} from "front-core/object-runtime";
import { COLUMN_TYPES } from "front-core/table";
import type { ThreadListParams } from "g-threads";
import { threadsClient } from "./services";
import { ThreadsSummary } from "./summary";
import { ThreadsStatsView } from "./views/ThreadsStatsView";
import { ThreadsView } from "./views/ThreadsView";

const threadsColumns = [
	{ id: "threadId", title: "Thread", type: COLUMN_TYPES.TEXT, primary: true },
	{ id: "kind", title: "Kind", type: COLUMN_TYPES.TEXT },
	{ id: "messageCount", title: "Messages", type: COLUMN_TYPES.NUMBER },
	{ id: "updatedAt", title: "Updated", type: COLUMN_TYPES.DATE },
];

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
		infinity: {
			tableId: "threads",
			title: "Threads",
			columns: threadsColumns,
			load: (params) => threadsClient.listThreads(params as ThreadListParams),
			rowRef: (row) => {
				const thread = row as { threadId?: unknown };
				return objectRef("threads.thread", String(thread.threadId ?? ""));
			},
			filters: [
				{
					id: "threadId",
					label: "Thread",
					type: "search",
					operator: "contains",
				},
				{
					id: "kind",
					label: "Kind",
					type: "select",
					operator: "eq",
					options: [
						{ value: "chat", label: "Chat" },
						{ value: "audio", label: "Audio" },
						{ value: "forum", label: "Forum" },
						{ value: "comment", label: "Comment" },
					],
				},
				{
					id: "messageCount",
					label: "Messages",
					type: "search",
					operator: "gte",
					valueType: "number",
				},
				{
					id: "updatedAt",
					label: "Updated",
					type: "search",
					operator: "gte",
					valueType: "number",
				},
			],
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

export default defineSurface({
	id: "sf-threads",
	label: "Threads",
	purpose: "Assistant conversation threads and their statistics",
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
			component: EntityListView,
		},
		{
			id: "threads.statistic.dashboard",
			accepts: setOf("threads.statistic"),
			component: ThreadsStatsView,
		},
	],
	operations: [],
});
