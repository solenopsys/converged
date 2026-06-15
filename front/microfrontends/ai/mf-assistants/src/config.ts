import { COLUMN_TYPES } from "front-core";

const formatBytes = (value: unknown) => {
    const bytes = typeof value === 'number' ? value : Number(value ?? 0);
    if (!Number.isFinite(bytes) || bytes <= 0) return '-';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex += 1;
    }
    const precision = unitIndex === 0 || size >= 100 ? 0 : 1;
    return `${size.toFixed(precision)} ${units[unitIndex]}`;
};

export const createChatsColumns = (t: (key: string) => string) => [
    { id: 'id', title: 'ID', type: COLUMN_TYPES.TEXT, width: 300, primary: true },
    { id: 'name', title: t('chatsList.columns.name'), type: COLUMN_TYPES.TEXT, width: 180 },
    { id: 'messagesCount', title: t('chatsList.columns.messages'), type: COLUMN_TYPES.NUMBER, width: 120 },
    { id: 'filesCount', title: 'Files', type: COLUMN_TYPES.NUMBER, width: 100 },
    { id: 'filesSize', title: 'Data', type: COLUMN_TYPES.CUSTOM, width: 120, render: formatBytes },
    { id: 'createdAt', title: t('chatsList.columns.createdAt'), type: COLUMN_TYPES.DATE, width: 190 },
    { id: 'updatedAt', title: t('chatsList.columns.updatedAt'), type: COLUMN_TYPES.DATE, width: 190 }
];
// Context management moved to mf-contexts (ms-contexts).
