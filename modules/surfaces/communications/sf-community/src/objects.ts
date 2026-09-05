import { EntityListView } from "front-core";
import {
	defineSurface,
	objectOf,
	objectRef,
	setOf,
} from "front-core/object-runtime";
import { COLUMN_TYPES } from "front-core/table";
import type { TopicListParams } from "g-community";
import { communityClient } from "./services";
import { TopicView } from "./views/TopicView";

const topicsColumns = [
	{ id: "title", title: "Topic", type: COLUMN_TYPES.TEXT, primary: true },
	{ id: "createdBy", title: "Author", type: COLUMN_TYPES.TEXT },
	{ id: "lastActivityAt", title: "Last activity", type: COLUMN_TYPES.DATE },
	{ id: "isPinned", title: "Pinned", type: COLUMN_TYPES.BOOLEAN },
];

export default defineSurface({
	id: "sf-community",
	label: "Community",
	purpose: "Public forum topics and discussions",
	types: [
		{
			id: "community.topic",
			label: "Forum topic",
			pluralLabel: "Forum topics",
			categories: ["core.communication", "core.selectable", "core.creatable"],
			selection: {
				filters: [],
				describe: () => communityClient.describeSelection("community.topic"),
				load: (params) => communityClient.listTopics(params),
				inspect: (filter) => communityClient.inspectTopics(filter),
			},
			infinity: {
				tableId: "community-topics",
				title: "Forum topics",
				columns: topicsColumns,
				load: (params) => communityClient.listTopics(params as TopicListParams),
				rowRef: (row) => {
					const topic = row as { id?: unknown; title?: unknown };
					const id = String(topic.id ?? "");
					return objectRef("community.topic", id, {
						title:
							typeof topic.title === "string" ? topic.title : `Topic ${id}`,
					});
				},
				filters: [
					{
						id: "title",
						label: "Topic",
						type: "search",
						operator: "contains",
					},
					{
						id: "sectionId",
						label: "Section",
						type: "search",
						operator: "eq",
					},
					{
						id: "isPinned",
						label: "Pinned",
						type: "select",
						operator: "eq",
						valueType: "boolean",
						options: [
							{ value: "true", label: "Pinned" },
							{ value: "false", label: "Unpinned" },
						],
					},
					{
						id: "isLocked",
						label: "Locked",
						type: "select",
						operator: "eq",
						valueType: "boolean",
						options: [
							{ value: "true", label: "Locked" },
							{ value: "false", label: "Open" },
						],
					},
					{
						id: "isArchived",
						label: "Archived",
						type: "select",
						operator: "eq",
						valueType: "boolean",
						options: [
							{ value: "true", label: "Archived" },
							{ value: "false", label: "Active" },
						],
					},
					{
						id: "lastActivityAt",
						label: "Last activity",
						type: "date-range",
						operator: "between",
						valueType: "date",
					},
				],
			},
		},
	],
	views: [
		{
			id: "community.topic.detail",
			accepts: objectOf("community.topic"),
			component: TopicView,
			props: (ref) => ({ topicId: ref.kind === "object" ? ref.id : undefined }),
		},
		{
			id: "community.topic.table",
			accepts: setOf("community.topic"),
			component: EntityListView,
		},
	],
	operations: [],
});
