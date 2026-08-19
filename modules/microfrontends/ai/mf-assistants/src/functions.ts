import type { CreateAction, CreateWidget } from "front-core";
import { assistantClient as chatsService } from "./services";
import { sample } from "effector";
import domain from "./domain";
import { ChatHistoryView } from "./views/ChatHistoryView";
import { ChatsListView } from "./views/ChatsListView";
import { CommandsListView } from "./views/CommandsListView";
import { ToolCallJsonView } from "./views/ToolCallJsonView";

const GET_CHATS_LIST = "chats.get_list";
const SHOW_CHATS_LIST = "chats.show_list";
const SHOW_COMMANDS_LIST = "chats.show_commands_list";
const VIEW_CHAT = "chats.view";
const VIEW_TOOL_CALL_JSON = "chats.view_tool_call_json";
const EDIT_CHAT = "chats.edit";
const DELETE_CHAT = "chats.delete";

const deleteChatFx = domain.createEffect<{ recordId: string }, void>({
	name: "DELETE_CHAT",
	handler: ({ recordId }) => chatsService.deleteChat(recordId),
});

const deleteChatEvent = domain.createEvent<{ recordId: string }>(
	"DELETE_CHAT_EVENT",
);
const editChatEvent = domain.createEvent<{ recordId: string }>(
	"EDIT_CHAT_EVENT",
);

sample({ clock: deleteChatEvent, target: deleteChatFx });

const createChatsListWidget: CreateWidget<typeof ChatsListView> = (bus) => ({
	view: ChatsListView,
	placement: () => "center",
	config: {
		bus,
	},
});

const createCommandsListWidget: CreateWidget<typeof CommandsListView> = (
	bus,
) => ({
	view: CommandsListView,
	placement: () => "center",
	config: {
		bus,
	},
});

const createChatHistoryWidget = (bus, params: { threadId: string }) => ({
	view: ChatHistoryView,
	placement: () => "center",
	config: {
		...params,
		bus,
		openToolCallJson: (payload) => {
			bus.present({ widget: createToolCallJsonWidget(bus, payload) });
		},
	},
	commands: {},
});

const createToolCallJsonWidget = (
	bus,
	params: {
		threadId: string;
		title: string;
		toolCallId?: string;
		summary?: string;
		details?: Record<string, unknown> | Array<unknown> | string;
	},
) => ({
	view: ToolCallJsonView,
	placement: () => "center",
	config: {
		...params,
	},
	commands: {},
});

const createShowChatsListAction: CreateAction<any> = (bus) => ({
	id: SHOW_CHATS_LIST,
	description: "Show chats list",
	invoke: () => {
		bus.present({ widget: createChatsListWidget(bus) });
	},
});

const createShowCommandsListAction: CreateAction<any> = (bus) => ({
	id: SHOW_COMMANDS_LIST,
	description: "Show available commands list",
	invoke: () => {
		bus.present({ widget: createCommandsListWidget(bus) });
	},
});

const createViewChatAction: CreateAction<any> = (bus) => ({
	id: VIEW_CHAT,
	description: "View chat details",
	invoke: ({ recordId, title }) => {
		if (!recordId) return;
		bus.present({
			widget: createChatHistoryWidget(bus, { threadId: recordId }),
			tab: { key: `${VIEW_CHAT}:${recordId}`, title: title ?? `Chat ${recordId}` },
		});
	},
});

const createViewToolCallJsonAction: CreateAction<any> = (bus) => ({
	id: VIEW_TOOL_CALL_JSON,
	description: "View tool call JSON",
	invoke: ({ threadId, title, toolCallId, summary, details }) => {
		if (!threadId) return;
		bus.present({
			widget: createToolCallJsonWidget(bus, {
				threadId,
				title: title ?? "Вызов функции",
				toolCallId,
				summary,
				details,
			}),
			tab: {
				key: `${VIEW_TOOL_CALL_JSON}:${toolCallId ?? threadId}`,
				title: title ?? "Вызов функции",
			},
		});
	},
});

const createEditChatAction: CreateAction<any> = () => ({
	id: EDIT_CHAT,
	description: "Edit chat",
	invoke: ({ recordId }) => {
		editChatEvent({ recordId });
	},
});

const createDeleteChatAction: CreateAction<any> = () => ({
	id: DELETE_CHAT,
	description: "Delete chat",
	invoke: ({ recordId }) => {
		deleteChatEvent({ recordId });
	},
});

const ACTIONS = [
	createShowChatsListAction,
	createShowCommandsListAction,
	createViewChatAction,
	createViewToolCallJsonAction,
	createEditChatAction,
	createDeleteChatAction,
];

export {
	GET_CHATS_LIST,
	SHOW_CHATS_LIST,
	SHOW_COMMANDS_LIST,
	VIEW_CHAT,
	VIEW_TOOL_CALL_JSON,
	EDIT_CHAT,
	DELETE_CHAT,
	createShowChatsListAction,
	createShowCommandsListAction,
	createViewChatAction,
	createViewToolCallJsonAction,
	createEditChatAction,
	createDeleteChatAction,
};

export default ACTIONS;
