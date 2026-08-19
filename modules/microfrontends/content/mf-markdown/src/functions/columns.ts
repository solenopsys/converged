import type { FieldConfig } from "front-core";

export const mdColumns: FieldConfig[] = [
  {
    id: "path",
    title: "Path",
    type: "text",
    tableVisible: true,
    formVisible: true,
  },
  {
    id: "content",
    title: "Content",
    type: "text",
    tableVisible: false,
    formVisible: true,
  },
];
