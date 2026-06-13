import { COLUMN_TYPES } from "front-core";

type Translate = (key: string) => string;

export const createRequestsColumns = (t: Translate) => [
  { id: "id",          title: t("list.columns.id"),          type: COLUMN_TYPES.TEXT,   width: 220, primary: true },
  { id: "status",      title: t("list.columns.status"),      type: COLUMN_TYPES.TEXT,   width: 140,
    statusConfig: {
      new:               { label: t("list.status.new"),                 className: "bg-blue-100 text-blue-800" },
      draft:             { label: t("list.status.draft"),               className: "bg-gray-100 text-gray-700" },
      needs_clarification: { label: t("list.status.needs_clarification"), className: "bg-yellow-100 text-yellow-800" },
      ready:             { label: t("list.status.ready"),               className: "bg-green-100 text-green-800" },
      in_production:     { label: t("list.status.in_production"),        className: "bg-purple-100 text-purple-800" },
      done:              { label: t("list.status.done"),                className: "bg-emerald-100 text-emerald-800" },
    },
  },
  { id: "processType", title: t("list.columns.type"),        type: COLUMN_TYPES.TEXT,   width: 140 },
  { id: "title",       title: t("list.columns.description"), type: COLUMN_TYPES.TEXT,   width: 280 },
  { id: "completion",  title: t("list.columns.completion"),  type: COLUMN_TYPES.TEXT,   width: 100,
    render: (value: any) => value ? `${value.percent ?? 0}%` : "—",
  },
  { id: "createdAt",   title: t("list.columns.createdAt"),   type: COLUMN_TYPES.DATE,   width: 160 },
];
