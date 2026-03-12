import type { FieldConfig } from "front-core";

export const mdColumns: FieldConfig[] = [
  {
    key: "path",
    title: "Path",
    type: "text",
    tableVisible: true,
    formVisible: true,
  },
  {
    key: "content",
    title: "Content",
    type: "text",
    tableVisible: false,
    formVisible: true,
  },
];
