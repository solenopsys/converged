import { CreateAction, chatInitRequested, upsertSidebarTab } from "front-core";
import {assistantClient as chatsService} from "./services";
import { CreateWidget } from 'front-core';
import { sample } from "effector";
import domain from "./domain";
import { ChatView } from "./views/ChatView";
import { ChatHistoryView } from "./views/ChatHistoryView";
import { ChatsListView } from "./views/ChatsListView";
import { CommandsListView } from "./views/CommandsListView";
import { ToolCallJsonView } from "./views/ToolCallJsonView";

const GET_CHATS_LIST = "chats.get_list";
const SHOW_CHATS_LIST = "chats.show_list";
const SHOW_COMMANDS_LIST = "chats.show_commands_list";
const SHOW_CHAT = "chats.show";
const VIEW_CHAT = "chats.view";
const VIEW_TOOL_CALL_JSON = "chats.view_tool_call_json";
const EDIT_CHAT = "chats.edit";
const DELETE_CHAT = "chats.delete";
const CHAT_HISTORY_TAB_ID = "chat-history";
const TOOL_CALL_JSON_TAB_ID = "chat-json";

// Effects and Events
const deleteChatFx = domain.createEffect<{ recordId: string }, void>({
    name: 'DELETE_CHAT',
    handler: ({ recordId }) => chatsService.deleteChat(recordId)
});

const deleteChatEvent = domain.createEvent<{ recordId: string }>('DELETE_CHAT_EVENT');
const editChatEvent = domain.createEvent<{ recordId: string }>('EDIT_CHAT_EVENT');

sample({ clock: deleteChatEvent, target: deleteChatFx });

const createChatsListWidget: CreateWidget<typeof ChatsListView> = (bus) => ({
    view: ChatsListView,
    placement: () => "center",
    config: {
        bus
    }
});

const createCommandsListWidget: CreateWidget<typeof CommandsListView> = (bus) => ({
    view: CommandsListView,
    placement: () => "center",
    config: {
        bus
    }
});

const createChatWidget: CreateWidget<typeof ChatView> = () => ({
    view: ChatView,
    placement: () => "sidebar:right",
    config: {},
    commands: {}
});

const createChatHistoryWidget = (bus, params: { threadId: string }) => ({
    view: ChatHistoryView,
    placement: () => `sidebar:tab:${CHAT_HISTORY_TAB_ID}`,
    config: {
        ...params,
        bus,
        openToolCallJson: (payload) => {
            bus.present({ widget: createToolCallJsonWidget(bus, payload) });
        },
    },
    commands: {}
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
    placement: () => `sidebar:tab:${TOOL_CALL_JSON_TAB_ID}`,
    config: {
        ...params,
    },
    commands: {}
});

const createShowChatAction: CreateAction<any> = (bus) => ({
    id: SHOW_CHAT,
    description: "Show chat widget",
    invoke: (params?: { contextName?: string }) => {
        const widget = createChatWidget(bus);
        chatInitRequested({ contextName: params?.contextName });
        bus.present({ widget, params });
    }
});

const createShowChatsListAction: CreateAction<any> = (bus) => ({
    id: SHOW_CHATS_LIST,
    description: "Show chats list",
    invoke: () => {
        bus.present({ widget: createChatsListWidget(bus) });
    }
});

const createShowCommandsListAction: CreateAction<any> = (bus) => ({
    id: SHOW_COMMANDS_LIST,
    description: "Show available commands list",
    invoke: () => {
        bus.present({ widget: createCommandsListWidget(bus) });
    }
});

const createViewChatAction: CreateAction<any> = (bus) => ({
    id: VIEW_CHAT,
    description: "View chat details",
    invoke: ({ recordId }) => {
        if (!recordId) return;
        upsertSidebarTab({
            id: CHAT_HISTORY_TAB_ID,
            title: "History",
            iconName: "history",
            order: 999,
        });
        bus.present({ widget: createChatHistoryWidget(bus, { threadId: recordId }) });
    }
});

const createViewToolCallJsonAction: CreateAction<any> = (bus) => ({
    id: VIEW_TOOL_CALL_JSON,
    description: "View tool call JSON",
    invoke: ({ threadId, title, toolCallId, summary, details }) => {
        if (!threadId) return;
        upsertSidebarTab({
            id: TOOL_CALL_JSON_TAB_ID,
            title: "JSON",
            iconName: "json",
            order: 1000,
        });
        bus.present({
            widget: createToolCallJsonWidget(bus, {
                threadId,
                title: title ?? "Вызов функции",
                toolCallId,
                summary,
                details,
            })
        });
    }
});

const createEditChatAction: CreateAction<any> = () => ({
    id: EDIT_CHAT,
    description: "Edit chat",
    invoke: ({ recordId }) => {
        editChatEvent({ recordId });
        // Здесь можно добавить логику для открытия формы редактирования
    }
});

const createDeleteChatAction: CreateAction<any> = () => ({
    id: DELETE_CHAT,
    description: "Delete chat",
    invoke: ({ recordId }) => {
        deleteChatEvent({ recordId });
    }
});

const ACTIONS = [
    createShowChatAction,
    createShowChatsListAction,
    createShowCommandsListAction,
    createViewChatAction,
    createViewToolCallJsonAction,
    createEditChatAction,
    createDeleteChatAction
];

export {
    GET_CHATS_LIST,
    SHOW_CHAT,
    SHOW_CHATS_LIST,
    SHOW_COMMANDS_LIST,
    VIEW_CHAT,
    VIEW_TOOL_CALL_JSON,
    EDIT_CHAT,
    DELETE_CHAT,
    createShowChatAction,
    createShowChatsListAction,
    createShowCommandsListAction,
    createViewChatAction,
    createViewToolCallJsonAction,
    createEditChatAction,
    createDeleteChatAction
};

export default ACTIONS;
