import { CreateAction } from "front-core";
import {assistantClient as chatsService, threadsClient} from "./services";
import { CreateWidget } from 'front-core';
import { sample } from "effector";
import domain from "./domain";
import { PaginatedResult, Chat } from "./types";
import { ChatView } from "./views/ChatView";
import { ChatsListView } from "./views/ChatsListView";
import { ContextsListView } from "./views/ContextsListView";
import { CommandsListView } from "./views/CommandsListView";
import { $chatsStore, openChatDetail } from "./domain-chats";

const GET_CHATS_LIST = "chats.get_list";
const SHOW_CHATS_LIST = "chats.show_list";
const SHOW_CONTEXTS_LIST = "chats.show_contexts_list";
const SHOW_COMMANDS_LIST = "chats.show_commands_list";
const SHOW_CHAT = "chats.show";
const VIEW_CHAT = "chats.view";
const EDIT_CHAT = "chats.edit";
const DELETE_CHAT = "chats.delete";

// Effects and Events
const deleteChatFx = domain.createEffect<{ recordId: string }, void>({
    name: 'DELETE_CHAT',
    handler: ({ recordId }) => chatsService.deleteChat(recordId)
});

export const getChatFx = domain.createEffect<string, object>({
    name: 'GET_CHAT',
    handler: (recordId) => {
        console.log("GET_CHAT", recordId);
        return chatsService.getChat(recordId);
    }
});

const deleteChatEvent = domain.createEvent<{ recordId: string }>('DELETE_CHAT_EVENT');
const editChatEvent = domain.createEvent<{ recordId: string }>('EDIT_CHAT_EVENT');

sample({ clock: openChatDetail, target: getChatFx });
sample({ clock: deleteChatEvent, target: deleteChatFx });

const createChatsListWidget: CreateWidget<typeof ChatsListView> = (bus) => ({
    view: ChatsListView,
    placement: () => "center",
    config: {
        bus
    }
});

const createContextsListWidget: CreateWidget<typeof ContextsListView> = (bus) => ({
    view: ContextsListView,
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

const createChatWidget: CreateWidget<typeof ChatView> = (bus) => ({
    view: ChatView,
    placement: () => "sidebar:right",
    config: {},
    commands: {}
});

export const createChatDetailWidget: CreateWidget<typeof ChatView> = (bus, params?: { recordId: string }) => ({
    view: ChatView,
    placement: () => "sidebar:right",
    config: {},
    commands: {}
});



const createShowChatAction: CreateAction<any> = (bus) => ({
    id: SHOW_CHAT,
    description: "Show chat widget",
    invoke: () => {
        console.log("[createShowChatAction] Presenting chat widget to sidebar:right");
        const widget = createChatWidget(bus);
        console.log("[createShowChatAction] Widget config:", widget);
        bus.present({ widget });
    }
});

const createShowChatsListAction: CreateAction<any> = (bus) => ({
    id: SHOW_CHATS_LIST,
    description: "Show chats list",
    invoke: () => {
        bus.present({ widget: createChatsListWidget(bus) });
    }
});

const createShowContextsListAction: CreateAction<any> = (bus) => ({
    id: SHOW_CONTEXTS_LIST,
    description: "Show contexts list",
    invoke: () => {
        bus.present({ widget: createContextsListWidget(bus) });
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
        openChatDetail({ recordId });
        bus.present({ widget: createChatDetailWidget(bus, { recordId }), params: { recordId } });
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
    createShowContextsListAction,
    createShowCommandsListAction,
    createViewChatAction,
    createEditChatAction,
    createDeleteChatAction
];

export {
    GET_CHATS_LIST,
    SHOW_CHAT,
    SHOW_CHATS_LIST,
    SHOW_CONTEXTS_LIST,
    SHOW_COMMANDS_LIST,
    VIEW_CHAT,
    EDIT_CHAT,
    DELETE_CHAT,
    createShowChatAction,
    createShowChatsListAction,
    createShowContextsListAction,
    createShowCommandsListAction,
    createViewChatAction,
    createEditChatAction,
    createDeleteChatAction
};

export default ACTIONS;
