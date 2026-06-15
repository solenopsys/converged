import { COLUMN_TYPES } from "front-core";

export const contextsColumns = [
  { id: "name", title: "Name", type: COLUMN_TYPES.TEXT, width: 260, primary: true },
  { id: "language", title: "Language", type: COLUMN_TYPES.TEXT, width: 120 },
  { id: "updatedAt", title: "Updated", type: COLUMN_TYPES.TEXT, width: 200 },
  { id: "size", title: "Size", type: COLUMN_TYPES.TEXT, width: 100 },
];
