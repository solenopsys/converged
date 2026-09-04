import {
	Category,
	defineSurface,
	type ObjectDefinition,
	objectOf,
	setOf,
} from "front-core/object-runtime";
import { assistantClient } from "./services";
import { ChatHistoryView } from "./views/ChatHistoryView";
import { ChatsListView } from "./views/ChatsListView";
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
			component: ChatsListView,
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
