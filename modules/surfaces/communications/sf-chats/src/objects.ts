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
import type { ChatRoomsListParams } from "g-chats";
import { chatsClient, threadsClient } from "./services";
import { ChatRoomView } from "./views/ChatRoomView";

/**
 * One tab, one function: rooms, one room's conversation, one room's members.
 *
 * The members list is a tab of its own rather than a panel inside the
 * conversation. Managing who is in a room and reading what they said are two
 * jobs, and putting them on one screen is what the previous `ChatView` did with
 * a room selector bolted above the transcript.
 */

const roomColumns = [
	{ id: "title", title: "Room", type: COLUMN_TYPES.TEXT, primary: true },
	{ id: "type", title: "Type", type: COLUMN_TYPES.TEXT },
	{ id: "membersCount", title: "Members", type: COLUMN_TYPES.NUMBER },
	{ id: "updatedAt", title: "Updated", type: COLUMN_TYPES.DATE },
];

const memberColumns = [
	{ id: "userId", title: "User", type: COLUMN_TYPES.TEXT, primary: true },
	{ id: "role", title: "Role", type: COLUMN_TYPES.TEXT },
	{ id: "joinedAt", title: "Joined", type: COLUMN_TYPES.DATE },
];

/** The room a members tab belongs to, carried in the set's own filter. */
function roomIdOf(params: Record<string, unknown>): string {
	const filter = params.filter as { roomId?: { eq?: unknown } } | undefined;
	return String(filter?.roomId?.eq ?? "");
}

export const objects = [
	{
		id: "chats.chat",
		label: "Chat",
		pluralLabel: "Chats",
		categories: [
			Category.Communication,
			Category.Selectable,
			Category.Creatable,
		],
		selection: {
			filters: [],
			describe: () => chatsClient.describeSelection("chats.chat"),
			load: (params) => chatsClient.listRooms(params),
			inspect: (filter) => chatsClient.inspectChats(filter),
		},
		infinity: {
			tableId: "chat-rooms",
			title: "Chats",
			columns: roomColumns,
			load: (params) => chatsClient.listRooms(params as ChatRoomsListParams),
			rowRef: (row) => {
				const room = row as { id?: unknown; title?: unknown };
				const id = String(room.id ?? "");
				return objectRef("chats.chat", id, {
					title: typeof room.title === "string" ? room.title : `Chat ${id}`,
				});
			},
			filters: [
				{ id: "title", label: "Room", type: "search", operator: "contains" },
				{
					id: "type",
					label: "Type",
					type: "select",
					operator: "eq",
					options: [
						{ value: "direct", label: "Direct" },
						{ value: "group", label: "Group" },
						{ value: "channel", label: "Channel" },
					],
				},
				{
					id: "archived",
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
					id: "updatedAt",
					label: "Updated",
					type: "date-range",
					operator: "between",
					valueType: "date",
				},
			],
		},
	},
	{
		id: "chats.member",
		label: "Room member",
		pluralLabel: "Room members",
		categories: [Category.Communication],
		infinity: {
			tableId: "chat-room-members",
			title: "Room members",
			columns: memberColumns,
			// `listRoomUsers` returns the whole membership of one room, which is
			// the entire set — there is nothing to paginate, so it is wrapped
			// rather than given offset/limit it would ignore.
			load: async (params) => {
				const roomId = roomIdOf(params);
				if (!roomId) return { items: [], totalCount: 0 };
				const items = await chatsClient.listRoomUsers(roomId);
				return { items, totalCount: items.length };
			},
		},
	},
] satisfies readonly ObjectDefinition[];

export default defineSurface({
	id: "sf-chats",
	label: "Chats",
	purpose: "Chat rooms, their conversations and their members",
	types: objects,
	views: [
		{
			id: "chats.chat.table",
			accepts: setOf("chats.chat"),
			component: EntityListView,
		},
		{
			id: "chats.chat.detail",
			accepts: objectOf("chats.chat"),
			component: ChatRoomView,
			props: (ref) => ({ roomId: ref.kind === "object" ? ref.id : undefined }),
		},
		{
			id: "chats.member.table",
			accepts: setOf("chats.member"),
			component: EntityListView,
		},
	],
	operations: [
		{
			id: "chats.chat.create",
			operator: "create",
			target: "chats.chat",
			label: "New room",
			description: "Create a chat room and add its first members",
			output: objectOf("chats.chat"),
			presentOutput: true,
			parameters: {
				type: "object",
				properties: {
					title: { type: "string" },
					type: { type: "string", enum: ["direct", "group", "channel"] },
					userIds: { type: "array", items: { type: "string" } },
					visibility: {
						type: "string",
						enum: ["public", "authenticated", "private", "tagged"],
					},
				},
				required: ["title"],
			},
			/**
			 * The room is created first and its thread registered second, from
			 * here. `rp-chats` mints the thread id but does not register it:
			 * doing so would be `rp-chats` calling `rp-threads`, and no
			 * repository calls another one.
			 */
			invoke: async ({ params }) => {
				const title = String(params.title ?? "").trim();
				if (!title) throw new Error("Room title is required");
				const raw = params.userIds;
				const userIds = Array.isArray(raw)
					? raw.map(String).filter(Boolean)
					: String(raw ?? "")
							.split(",")
							.map((value) => value.trim())
							.filter(Boolean);

				const room = await chatsClient.createRoom({
					title,
					type: (params.type as never) || "group",
					visibility: (params.visibility as never) || undefined,
					userIds,
				});
				await threadsClient.registerThread(room.threadId, "chat");
				return objectRef("chats.chat", room.id, { title });
			},
		},
		{
			id: "chats.chat.members",
			operator: "show",
			target: "chats.chat",
			label: "Room members",
			description: "Open the membership of a room as its own tab",
			inputs: [{ name: "room", accepts: objectOf("chats.chat") }],
			output: setOf("chats.member"),
			presentOutput: true,
			invoke: ({ references }) => {
				const ref = references.find(
					(item) => item.kind === "object" && item.type === "chats.chat",
				);
				if (ref?.kind !== "object")
					throw new Error("Room reference is required");
				return setRef(
					"chats.member",
					{ kind: "query", filter: { roomId: { eq: ref.id } } },
					{ title: ref.title ? `${ref.title} · members` : "Room members" },
				);
			},
		},
		{
			id: "chats.member.add",
			operator: "add",
			target: "chats.member",
			label: "Add member",
			inputs: [{ name: "room", accepts: objectOf("chats.chat") }],
			parameters: {
				type: "object",
				properties: {
					roomId: { type: "string" },
					userId: { type: "string" },
					role: { type: "string", enum: ["owner", "admin", "member"] },
				},
				required: ["userId"],
			},
			invoke: async ({ references, params }) => {
				const ref = references.find(
					(item) => item.kind === "object" && item.type === "chats.chat",
				);
				const roomId =
					String(params.roomId ?? "") || (ref?.kind === "object" ? ref.id : "");
				const userId = String(params.userId ?? "").trim();
				if (!roomId) throw new Error("Room reference is required");
				if (!userId) throw new Error("User is required");
				return chatsClient.addRoomUser(roomId, userId, params.role as never);
			},
		},
		{
			id: "chats.member.remove",
			operator: "remove",
			target: "chats.member",
			label: "Remove member",
			inputs: [{ name: "room", accepts: objectOf("chats.chat") }],
			parameters: {
				type: "object",
				properties: {
					roomId: { type: "string" },
					userId: { type: "string" },
				},
				required: ["userId"],
			},
			invoke: async ({ references, params }) => {
				const ref = references.find(
					(item) => item.kind === "object" && item.type === "chats.chat",
				);
				const roomId =
					String(params.roomId ?? "") || (ref?.kind === "object" ? ref.id : "");
				const userId = String(params.userId ?? "").trim();
				if (!roomId) throw new Error("Room reference is required");
				if (!userId) throw new Error("User is required");
				return chatsClient.removeRoomUser(roomId, userId);
			},
		},
	],
});
