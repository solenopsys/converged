import Player from "./components/Player";
import { COLUMN_TYPES, Widget, Action, UniversalDataTable, sample } from "converged-core";
import { Play, Pause, Square, Volume2, Upload, Trash2, Music, Eye, Edit3 } from 'lucide-react';
import {createEvent, createEffect} from "effector";
// import { chatsService } from "converged-core";

// Events and Effects
export const listChatsFx = createEffect<
    { page?: number; after?: string },
    { ids: string[]; cursor?: string; itemsById: Record<string, any> }
>(); // Подключить к chatsService.listOfChats

export const deleteChatFx = createEffect<{ recordId: string }, void>();
export const openTrackEvent = createEvent<{ trackId?: string }>();
export const openChatDetail = createEvent<{ recordId: string }>();
export const deleteChatEvent = createEvent<{ recordId: string }>();
export const editChatEvent = createEvent<{ recordId: string }>();
export const listChatsRequest = createEvent<{ page?: number; after?: string }>();

// Table columns configuration
const chatsColumns = [
    { id: 'id', title: 'ID', type: COLUMN_TYPES.NUMBER, width: 80 },
    { id: 'title', title: 'Заголовок чата', type: COLUMN_TYPES.TEXT, minWidth: 200 },
    { id: 'contact', title: 'Контакт', type: COLUMN_TYPES.TEXT, width: 150 },
    {
        id: 'ticketLink',
        title: 'Ссылка на заявку',
        type: COLUMN_TYPES.TEXT,
        width: 150
    },
    {
        id: 'type',
        title: 'Тип',
        type: COLUMN_TYPES.STATUS,
        width: 120,
        statusConfig: {
            useful: { label: 'Полезный', variant: 'default' },
            useless: { label: 'Бесполезный', variant: 'destructive' }
        }
    },
    { id: 'date', title: 'Дата', type: COLUMN_TYPES.DATE, width: 120 },
    {
        id: 'actions',
        title: 'Действия',
        type: COLUMN_TYPES.ACTIONS,
        width: 80,
        sortable: false,
        actions: [
            { id: 'view', label: 'Просмотр', icon: Eye },
            { id: 'edit', label: 'Редактировать', icon: Edit3 },
            { id: 'delete', label: 'Удалить', icon: Trash2, variant: 'danger' }
        ]
    }
];

// Widgets
const PlayerWidget: Widget<typeof Player> = {
    view: Player,
    placement: (ctx) => "right",
    mount: () => {
        // Initialization logic if needed
    },
    commands: {
        play: (trackData) => {
            // Handle play command
        },
        pause: () => {
            // Handle pause command
        },
        stop: () => {
            // Handle stop command
        },
        volumeChange: (volume) => {
            // Handle volume change
        }
    }
};

const ChatsListWidget: Widget<typeof UniversalDataTable> = {
    view: UniversalDataTable,
    placement: (ctx) => "center",
    config: { columns: chatsColumns },
    mount: ({ page, after }) => listChatsRequest({ page, after }),
    commands: {
        rowClick: ({ id }) => openChatDetail({ recordId: id }),
        loadPage: ({ page, after }) => listChatsRequest({ page, after }),
        actionClick: ({ actionId, recordId }) => {
            switch (actionId) {
                case 'view':
                    openChatDetail({ recordId });
                    break;
                case 'edit':
                    editChatEvent({ recordId });
                    break;
                case 'delete':
                    deleteChatEvent({ recordId });
                    break;
            }
        }
    }
};

// Actions
const GetChatsListAction: Action = {
    id: "chats.get_list",
    description: "Получить список чатов",
    invoke: ({ page, after }) => listChatsRequest({ page, after })
};

const ShowChatsListAction: Action = {
    id: "chats.show_list",
    description: "Просмотреть список чатов",
    invoke: () => {
        present(ChatsListWidget);
    }
};

const OpenTrackAction: Action = {
    id: "player.open_track",
    description: "Открыть трек в плеере",
    invoke: ({ trackId }) => {
        openTrackEvent({ trackId });
        present(PlayerWidget);
    }
};

const ShowPlayerAction: Action = {
    id: "player.show",
    description: "Показать плеер",
    invoke: () => {
        present(PlayerWidget);
    }
};

const ViewChatAction: Action = {
    id: "chats.view",
    description: "Просмотр чата",
    invoke: ({ recordId }) => {
        openChatDetail({ recordId });
    }
};

const EditChatAction: Action = {
    id: "chats.edit",
    description: "Редактировать чат",
    invoke: ({ recordId }) => {
        editChatEvent({ recordId });
    }
};

const DeleteChatAction: Action = {
    id: "chats.delete",
    description: "Удалить чат",
    invoke: ({ recordId }) => {
        deleteChatEvent({ recordId });
    }
};



export {
    PlayerWidget,
    ChatsListWidget,

};

export default [
    GetChatsListAction,
    ShowChatsListAction,
    OpenTrackAction,
    ShowPlayerAction,
    ViewChatAction,
    EditChatAction,
    DeleteChatAction]