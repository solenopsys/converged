import { EntityListView } from "front-core";
import {
	Category,
	defineSurface,
	type ObjectDefinition,
	objectOf,
	objectRef,
	setOf,
} from "front-core/object-runtime";
import type { PaginationParams } from "g-assistant";
import { chatsColumns } from "./config";
import { assistantClient } from "./services";
import { ChatHistoryView } from "./views/ChatHistoryView";
import { CommandsListView } from "./views/CommandsListView";
import { ToolCallJsonView } from "./views/ToolCallJsonView";

export const objects = [
	{
		id: "assistants.chat",
		label: "Assistant chat",
		pluralLabel: "Assistant chats",
		categories: [
			Category.Communication,
			Category.Selectable,
			Category.Editable,
		],
		infinity: {
			tableId: "assistants-chats",
			title: "Assistant chats",
			columns: chatsColumns,
			load: (params) => assistantClient.listOfChats(params as PaginationParams),
			rowRef: (chat) =>
				objectRef("assistants.chat", String(chat.id), {
					title: typeof chat.name === "string" ? chat.name : undefined,
				}),
			filters: [
				{
					id: "name",
					label: "Name",
					type: "search",
					operator: "contains",
				},
			],
		},
	},
	{
		id: "assistants.tool-call",
		label: "Tool call",
		pluralLabel: "Tool calls",
		categories: [Category.Entity, Category.Selectable],
	},
	{
		id: "assistants.command",
		label: "Assistant command",
		pluralLabel: "Assistant commands",
		categories: [Category.Entity, Category.Selectable, Category.Executable],
	},
] satisfies readonly ObjectDefinition[];

export default defineSurface({
	id: "sf-assistants",
	label: "Assistants",
	purpose:
		"Assistant chat history, recorded tool calls and registered commands",
	types: objects,
	views: [
		{
			id: "assistants.chat.history",
			accepts: objectOf("assistants.chat"),
			component: ChatHistoryView,
			props: (ref) => ({
				threadId: ref.kind === "object" ? ref.id : undefined,
			}),
		},
		{
			id: "assistants.chat.table",
			accepts: setOf("assistants.chat"),
			component: EntityListView,
		},
		{
			id: "assistants.tool-call.detail",
			accepts: objectOf("assistants.tool-call"),
			component: ToolCallJsonView,
			props: (ref) => ({
				toolCallId: ref.kind === "object" ? ref.id : undefined,
				title: ref.title ?? "Tool call",
			}),
		},
		{
			id: "assistants.command.table",
			accepts: setOf("assistants.command"),
			component: CommandsListView,
		},
	],
	operations: [
		{
			id: "assistants.chat.delete",
			operator: "execute",
			target: "assistants.chat",
			label: "Delete chat",
			inputs: [{ name: "chat", accepts: objectOf("assistants.chat") }],
			invoke: async ({ references }) => {
				const chat = references.find(
					(ref) => ref.kind === "object" && ref.type === "assistants.chat",
				);
				if (chat?.kind === "object") await assistantClient.deleteChat(chat.id);
			},
		},
	],
});
