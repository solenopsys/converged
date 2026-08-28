import { COLUMN_TYPES } from "front-core/table";

type Translate = (key: string) => unknown;

export const sessionsColumns = (t: Translate) => [
  { id: "id", title: "ID", type: COLUMN_TYPES.TEXT, width: 280, primary: true },
  { id: "model", title: t("columns.model") as string, type: COLUMN_TYPES.TEXT, width: 200 },
  { id: "messageCount", title: t("columns.messageCount") as string, type: COLUMN_TYPES.NUMBER, width: 120 },
  { id: "updatedAt", title: t("columns.updatedAt") as string, type: COLUMN_TYPES.DATE, width: 180 },
];

export const toolsColumns = (t: Translate) => [
  { id: "name", title: t("columns.name") as string, type: COLUMN_TYPES.TEXT, width: 200, primary: true },
  { id: "description", title: t("columns.description") as string, type: COLUMN_TYPES.TEXT, width: 400 },
];
