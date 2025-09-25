import { UniversalDataTable } from "converged-core";
import {aichatClient as chatsService, threadsClient} from "./services";
import { COLUMN_TYPES, CreateWidget, CreateAction, createTableStore } from 'converged-core';
import { sample } from "effector";
import domain from "./domain";
import { chatsColumns } from "./config";
import { PaginationParams, PaginatedResult, Chat } from "./types";
import { ChatDetailView } from "./views/ChatDetailView";

const GET_CHATS_LIST = "chats.get_list";
const SHOW_CHATS_LIST = "chats.show_list";
const VIEW_CHAT = "chats.view";
const EDIT_CHAT = "chats.edit";
const DELETE_CHAT = "chats.delete";

// Effects and Events
const listChatsFx = domain.createEffect<PaginationParams, PaginatedResult<Chat>>({
    name: 'LIST_CHATS',
    handler: chatsService.listOfChats
});

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

const openChatDetail = domain.createEvent<{ recordId: string }>('OPEN_CHAT_DETAIL');
const deleteChatEvent = domain.createEvent<{ recordId: string }>('DELETE_CHAT_EVENT');
const editChatEvent = domain.createEvent<{ recordId: string }>('EDIT_CHAT_EVENT');
const getChatsListEvent = domain.createEvent<{ offset?: number; limit?: number }>('GET_CHATS_LIST_EVENT');

sample({ clock: openChatDetail, target: getChatFx });
sample({ clock: getChatsListEvent, target: listChatsFx });
sample({ clock: deleteChatEvent, target: deleteChatFx });

const chatStore = domain.createStore(null);

sample({ clock: getChatFx.doneData, target: chatStore });

// Wrapper функция для использования в TableView
const chatDataFunction = async (params: PaginationParams) => {
    return await chatsService.listOfChats(params);
};

const $chatStore = createTableStore(domain, chatDataFunction);

const createChatsListWidget: CreateWidget<typeof UniversalDataTable> = (bus) => ({
    view: UniversalDataTable,
    placement: () => "center",
    config: {
        columns: chatsColumns,
        title: "Chats List",
        store: $chatStore,
        defaultPageSize: 20,
        pageSizeOptions: [10, 20, 50, 100]
    },
    commands: {
        onRowClick: (row: { id: string }) => {
            const recordId = row.id;
            openChatDetail({ recordId });
            bus.present({ widget: createChatDetailWidget(bus), params: { recordId } });
            console.log("ROW CLICK", row);
        },
        onActionClick: ({ actionId, recordId }: { actionId: string; recordId: string }) => {
            switch (actionId) {
                case 'view':
                    openChatDetail({ recordId });
                    bus.present({ widget: createChatDetailWidget(bus), params: { recordId } });
                    break;
                case 'edit':
                    editChatEvent({ recordId });
                    // Здесь можно добавить вызов виджета редактирования
                    break;
                case 'delete':
                    deleteChatEvent({ recordId });
                    break;
            }
        }
    }
});

const createChatDetailWidget: CreateWidget<typeof ChatDetailView> = () => ({
    view: ChatDetailView,
    placement: () => "right",
    config: {
        chatStore: chatStore
    },
    commands: {
        edit: () => {
            // Handle edit action
        },
        close: () => {
            // Handle close action
        }
    }
});

const createGetChatsListAction: CreateAction<any> = () => ({
    id: GET_CHATS_LIST,
    description: "Get chats list",
    invoke: async ({ offset = 0, limit = 20 }) => {
        getChatsListEvent({ offset, limit });
        return await chatsService.listOfChats({ offset, limit });
    }
});

const createShowChatsListAction: CreateAction<any> = (bus) => ({
    id: SHOW_CHATS_LIST,
    description: "Show chats list",
    invoke: () => {
        getChatsListEvent({ offset: 0, limit: 20 });
        bus.present({ widget: createChatsListWidget(bus) });
    }
});

const createViewChatAction: CreateAction<any> = (bus) => ({
    id: VIEW_CHAT,
    description: "View chat details",
    invoke: ({ recordId }) => {
        openChatDetail({ recordId });
        bus.present({ widget: createChatDetailWidget(bus), params: { recordId } });
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
    createGetChatsListAction,
    createShowChatsListAction,
    createViewChatAction,
    createEditChatAction,
    createDeleteChatAction
];

export {
    GET_CHATS_LIST,
    SHOW_CHATS_LIST,
    VIEW_CHAT,
    EDIT_CHAT,
    DELETE_CHAT,
    createGetChatsListAction,
    createShowChatsListAction,
    createViewChatAction,
    createEditChatAction,
    createDeleteChatAction,
    openChatDetail
};

export default ACTIONS;