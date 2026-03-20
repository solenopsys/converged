import { COLUMN_TYPES } from "front-core";

export const sessionsColumns = [
  { id: "id", title: "ID", type: COLUMN_TYPES.TEXT, width: 280, primary: true },
  { id: "model", title: "Модель", type: COLUMN_TYPES.TEXT, width: 200 },
  { id: "messageCount", title: "Сообщения", type: COLUMN_TYPES.NUMBER, width: 120 },
  { id: "updatedAt", title: "Обновлено", type: COLUMN_TYPES.DATE, width: 180 },
];

export const toolsColumns = [
  { id: "name", title: "Имя", type: COLUMN_TYPES.TEXT, width: 200, primary: true },
  { id: "description", title: "Описание", type: COLUMN_TYPES.TEXT, width: 400 },
];
