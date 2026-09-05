import { EntityListView } from "front-core";
import {
	defineSurface,
	objectOf,
	objectRef,
	setOf,
} from "front-core/object-runtime";
import { COLUMN_TYPES } from "front-core/table";
import type { ChatRoomsListParams } from "g-chats";
import { chatsClient } from "./services";
import { ChatRoomView } from "./views/ChatRoomView";

const chatsColumns = [
	{ id: "title", title: "Room", type: COLUMN_TYPES.TEXT, primary: true },
	{ id: "type", title: "Type", type: COLUMN_TYPES.TEXT },
	{ id: "membersCount", title: "Members", type: COLUMN_TYPES.NUMBER },
	{ id: "updatedAt", title: "Updated", type: COLUMN_TYPES.DATE },
];

export default defineSurface({
	id: "sf-chats",
	label: "Chats",
	purpose: "Chat conversations with visitors and customers",
	types: [
		{
			id: "chats.chat",
			label: "Chat",
			pluralLabel: "Chats",
			categories: ["core.communication", "core.selectable"],
			selection: {
				filters: [],
				describe: () => chatsClient.describeSelection("chats.chat"),
				load: (params) => chatsClient.listRooms(params),
				inspect: (filter) => chatsClient.inspectChats(filter),
			},
			infinity: {
				tableId: "chat-rooms",
				title: "Chats",
				columns: chatsColumns,
				load: (params) => chatsClient.listRooms(params as ChatRoomsListParams),
				rowRef: (row) => {
					const room = row as { id?: unknown; title?: unknown };
					const id = String(room.id ?? "");
					return objectRef("chats.chat", id, {
						title: typeof room.title === "string" ? room.title : `Chat ${id}`,
					});
				},
				filters: [
					{
						id: "title",
						label: "Room",
						type: "search",
						operator: "contains",
					},
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
						id: "processed",
						label: "Processed",
						type: "select",
						operator: "eq",
						valueType: "boolean",
						options: [
							{ value: "true", label: "Processed" },
							{ value: "false", label: "Unprocessed" },
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
	],
	views: [
		{
			id: "chats.chat.detail",
			accepts: objectOf("chats.chat"),
			component: ChatRoomView,
			props: (ref) => ({ roomId: ref.kind === "object" ? ref.id : undefined }),
		},
		{
			id: "chats.chat.table",
			accepts: setOf("chats.chat"),
			component: EntityListView,
		},
	],
	operations: [],
});
