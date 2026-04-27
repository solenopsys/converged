import { COLUMN_TYPES } from "front-core";

export const createChatsColumns = (t: (key: string) => string) => [
    { id: 'id', title: 'ID', type: COLUMN_TYPES.TEXT, width: 300, primary: true },
    { id: 'name', title: t('chatsList.columns.name'), type: COLUMN_TYPES.TEXT, width: 180 },
    { id: 'messagesCount', title: t('chatsList.columns.messages'), type: COLUMN_TYPES.NUMBER, width: 120 },
    { id: 'createdAt', title: t('chatsList.columns.createdAt'), type: COLUMN_TYPES.DATE, width: 190 },
    { id: 'updatedAt', title: t('chatsList.columns.updatedAt'), type: COLUMN_TYPES.DATE, width: 190 }
];

export const contextsColumns = [
    { id: 'id', title: 'ID', type: COLUMN_TYPES.TEXT, width: 280, primary: true },
    { id: 'chatId', title: 'Chat ID', type: COLUMN_TYPES.TEXT, width: 240 },
    { id: 'updatedAt', title: 'Updated', type: COLUMN_TYPES.TEXT, width: 180 },
    { id: 'size', title: 'Size', type: COLUMN_TYPES.TEXT, width: 100 }
];

export const createContextsColumns = (t: (key: string) => string) => [
    { id: 'id', title: 'ID', type: COLUMN_TYPES.TEXT, width: 280, primary: true },
    { id: 'chatId', title: t('contextsList.columns.chatId'), type: COLUMN_TYPES.TEXT, width: 240 },
    { id: 'updatedAt', title: t('contextsList.columns.updatedAt'), type: COLUMN_TYPES.TEXT, width: 180 },
    { id: 'size', title: t('contextsList.columns.size'), type: COLUMN_TYPES.TEXT, width: 100 }
];
