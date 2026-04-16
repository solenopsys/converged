import type { FieldConfig } from "front-core";

function formatDate(value: number | null): string {
  if (!value) return "";
  return new Date(value * 1000).toLocaleString();
}

export const staticColumns: FieldConfig[] = [
  {
    id: "id",
    title: "ID",
    type: "text",
    tableVisible: true,
    formVisible: true,
  },
  {
    id: "status",
    title: "Status",
    type: "text",
    tableVisible: true,
    formVisible: true,
  },
  {
    id: "contentType",
    title: "Type",
    type: "text",
    tableVisible: true,
    formVisible: true,
  },
  {
    id: "size",
    title: "Size",
    type: "number",
    tableVisible: true,
    formVisible: true,
  },
  {
    id: "loadedAt",
    title: "Loaded",
    type: "text",
    tableVisible: true,
    formVisible: false,
    tableRender: (value: number | null) => formatDate(value),
  },
  {
    id: "updatedAt",
    title: "Updated",
    type: "text",
    tableVisible: true,
    formVisible: false,
    tableRender: (value: number | null) => formatDate(value),
  },
];
