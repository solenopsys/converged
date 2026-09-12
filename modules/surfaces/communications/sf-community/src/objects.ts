import { EntityListView } from "front-core";
import {
	Category,
	defineSurface,
	type ObjectDefinition,
	objectOf,
	objectRef,
	setOf,
	setRef,
} from "front-core/object-runtime";
import { COLUMN_TYPES } from "front-core/table";
import type { SectionListParams, TopicListParams } from "g-community";
import { MessageType } from "g-threads";
import { communityClient, threadsClient } from "./services";
import { TopicView } from "./views/TopicView";

/**
 * One tab, one function.
 *
 * Sections list sections. Opening one yields a tab that lists that section's
 * topics — a set reference, so it is the same generic list the runtime already
 * knows how to mount. Opening a topic yields a tab with that topic's thread.
 * Nothing shows two of those at once; the combined screen this replaced had a
 * section tree, a topic table and a thread sharing one viewport.
 */

const sectionColumns = [
	{ id: "title", title: "Section", type: COLUMN_TYPES.TEXT, primary: true },
	{ id: "slug", title: "Slug", type: COLUMN_TYPES.TEXT },
	{ id: "visibility", title: "Visibility", type: COLUMN_TYPES.TEXT },
	{ id: "updatedAt", title: "Updated", type: COLUMN_TYPES.DATE },
];

const topicColumns = [
	{ id: "title", title: "Topic", type: COLUMN_TYPES.TEXT, primary: true },
	{ id: "createdBy", title: "Author", type: COLUMN_TYPES.TEXT },
	{ id: "lastActivityAt", title: "Last activity", type: COLUMN_TYPES.DATE },
	{ id: "isPinned", title: "Pinned", type: COLUMN_TYPES.BOOLEAN },
	{ id: "isLocked", title: "Locked", type: COLUMN_TYPES.BOOLEAN },
];

export const objects = [
	{
		id: "community.section",
		label: "Forum section",
		pluralLabel: "Forum sections",
		categories: [Category.Communication, Category.Creatable],
		infinity: {
			tableId: "community-sections",
			title: "Forum sections",
			columns: sectionColumns,
			load: (params) =>
				communityClient.listSections(params as SectionListParams),
			// A section is a container, so opening one opens what it contains.
			// There is no "section detail" screen because there is nothing on it
			// a list of its topics does not already say.
			rowRef: (row) => {
				const section = row as { id?: unknown; title?: unknown };
				const id = String(section.id ?? "");
				return setRef(
					"community.topic",
					{ kind: "query", filter: { sectionId: { eq: id } } },
					{
						title:
							typeof section.title === "string"
								? section.title
								: `Section ${id}`,
					},
				);
			},
			filters: [
				{ id: "title", label: "Section", type: "search", operator: "contains" },
			],
		},
	},
	{
		id: "community.topic",
		label: "Forum topic",
		pluralLabel: "Forum topics",
		categories: [
			Category.Communication,
			Category.Selectable,
			Category.Creatable,
		],
		selection: {
			filters: [],
			describe: () => communityClient.describeSelection("community.topic"),
			load: (params) => communityClient.listTopics(params),
			inspect: (filter) => communityClient.inspectTopics(filter),
		},
		infinity: {
			tableId: "community-topics",
			title: "Forum topics",
			columns: topicColumns,
			load: (params) => communityClient.listTopics(params as TopicListParams),
			rowRef: (row) => {
				const topic = row as { id?: unknown; title?: unknown };
				const id = String(topic.id ?? "");
				return objectRef("community.topic", id, {
					title: typeof topic.title === "string" ? topic.title : `Topic ${id}`,
				});
			},
			filters: [
				{ id: "title", label: "Topic", type: "search", operator: "contains" },
				{ id: "sectionId", label: "Section", type: "search", operator: "eq" },
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
] satisfies readonly ObjectDefinition[];

export default defineSurface({
	id: "sf-community",
	label: "Community",
	purpose: "Forum sections, topics and discussions",
	types: objects,
	views: [
		{
			id: "community.section.table",
			accepts: setOf("community.section"),
			component: EntityListView,
		},
		{
			id: "community.topic.table",
			accepts: setOf("community.topic"),
			component: EntityListView,
		},
		{
			id: "community.topic.detail",
			accepts: objectOf("community.topic"),
			component: TopicView,
			props: (ref) => ({ topicId: ref.kind === "object" ? ref.id : undefined }),
		},
	],
	operations: [
		{
			id: "community.section.create",
			operator: "create",
			target: "community.section",
			label: "Create section",
			description: "Add a forum section",
			output: setOf("community.topic"),
			presentOutput: true,
			parameters: {
				type: "object",
				properties: {
					title: { type: "string" },
					slug: { type: "string" },
					parentId: { type: "string" },
					visibility: {
						type: "string",
						enum: ["public", "authenticated", "private", "tagged"],
					},
				},
				required: ["title"],
			},
			invoke: async ({ params }) => {
				const title = String(params.title ?? "").trim();
				if (!title) throw new Error("Section title is required");
				const slug =
					String(params.slug ?? "").trim() ||
					title
						.toLowerCase()
						.replace(/[^a-z0-9]+/g, "-")
						.replace(/^-|-$/g, "");
				const id = await communityClient.saveSection({
					title,
					slug,
					parentId: (params.parentId as string) || undefined,
					visibility: (params.visibility as never) || undefined,
				});
				return setRef(
					"community.topic",
					{ kind: "query", filter: { sectionId: { eq: id } } },
					{ title },
				);
			},
		},
		{
			id: "community.section.delete",
			operator: "delete",
			target: "community.section",
			label: "Delete section",
			description: "Delete a section and every topic under it",
			inputs: [{ name: "section", accepts: objectOf("community.section") }],
			invoke: async ({ references }) => {
				const ref = references.find(
					(item) => item.kind === "object" && item.type === "community.section",
				);
				if (ref?.kind !== "object")
					throw new Error("Section reference is required");
				return communityClient.deleteSection(ref.id);
			},
		},
		{
			id: "community.topic.create",
			operator: "create",
			target: "community.topic",
			label: "New topic",
			description: "Start a forum topic with its opening post",
			output: objectOf("community.topic"),
			presentOutput: true,
			parameters: {
				type: "object",
				properties: {
					sectionId: { type: "string" },
					title: { type: "string" },
					body: { type: "string" },
				},
				required: ["sectionId", "title"],
			},
			/**
			 * Three calls, deliberately not one.
			 *
			 * `createTopic` mints the topic id and the thread id server-side and
			 * stamps the author from the token — the browser cannot choose either.
			 * Registering the thread and writing the opening post then happen
			 * against `rp-threads`, from here, because `rp-community` calling
			 * `rp-threads` is the cross-service call the architecture forbids.
			 *
			 * A failure after the topic exists leaves an empty topic, not a
			 * corrupt one: the thread materialises on its first message, so the
			 * next post fixes it.
			 */
			invoke: async ({ params }) => {
				const sectionId = String(params.sectionId ?? "").trim();
				const title = String(params.title ?? "").trim();
				if (!sectionId) throw new Error("Section is required");
				if (!title) throw new Error("Topic title is required");

				const topic = await communityClient.createTopic({ sectionId, title });
				// The thread is opened to the same audience as the topic. They are
				// separate repositories with separate tag tables, so the only thing
				// that keeps them in step is this call, made by the client that
				// just created both.
				await threadsClient.registerThread(topic.threadId, "forum", {
					visibility: topic.visibility,
				});

				const body = String(params.body ?? "").trim();
				if (body) {
					await threadsClient.saveMessage({
						threadId: topic.threadId,
						user: topic.createdBy,
						type: MessageType.message,
						data: body,
						timestamp: Date.now(),
					});
				}
				return objectRef("community.topic", topic.id, { title: topic.title });
			},
		},
		{
			id: "community.topic.set-flags",
			operator: "save",
			target: "community.topic",
			label: "Pin, lock or archive topic",
			description: "Moderation flags of one topic",
			inputs: [{ name: "topic", accepts: objectOf("community.topic") }],
			parameters: {
				type: "object",
				properties: {
					isPinned: { type: "boolean" },
					isLocked: { type: "boolean" },
					isArchived: { type: "boolean" },
				},
			},
			invoke: async ({ references, params }) => {
				const ref = references.find(
					(item) => item.kind === "object" && item.type === "community.topic",
				);
				if (ref?.kind !== "object")
					throw new Error("Topic reference is required");
				const topic = await communityClient.readTopic(ref.id);
				if (!topic) throw new Error(`Unknown topic: ${ref.id}`);
				return communityClient.saveTopic({
					id: topic.id,
					sectionId: topic.sectionId,
					threadId: topic.threadId,
					title: topic.title,
					isPinned: (params.isPinned as boolean) ?? topic.isPinned,
					isLocked: (params.isLocked as boolean) ?? topic.isLocked,
					isArchived: (params.isArchived as boolean) ?? topic.isArchived,
					visibility: topic.visibility,
				});
			},
		},
	],
});
