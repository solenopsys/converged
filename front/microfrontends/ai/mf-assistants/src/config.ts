import { COLUMN_TYPES,  } from "front-core";

// Table columns configuration - упрощенная версия с ID и описанием
export  const chatsColumns = [
    { id: 'id', title: 'ID', type: COLUMN_TYPES.TEXT, width: 300, primary: true },
    { id: 'description', title: 'Описание', type: COLUMN_TYPES.TEXT, width: 150 }
];

export const contextsColumns = [
    { id: 'id', title: 'ID', type: COLUMN_TYPES.TEXT, width: 280, primary: true },
    { id: 'chatId', title: 'Chat ID', type: COLUMN_TYPES.TEXT, width: 240 },
    { id: 'updatedAt', title: 'Updated', type: COLUMN_TYPES.TEXT, width: 180 },
    { id: 'size', title: 'Size', type: COLUMN_TYPES.TEXT, width: 100 }
];
