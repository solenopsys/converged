import { COLUMN_TYPES } from "front-core";

export const requestsColumns = [
  { id: "id",          title: "ID",          type: COLUMN_TYPES.TEXT,   width: 220, primary: true },
  { id: "status",      title: "Статус",      type: COLUMN_TYPES.TEXT,   width: 140,
    statusConfig: {
      new:               { label: "Новая",        className: "bg-blue-100 text-blue-800" },
      draft:             { label: "Черновик",      className: "bg-gray-100 text-gray-700" },
      needs_clarification: { label: "Уточнение",  className: "bg-yellow-100 text-yellow-800" },
      ready:             { label: "Готова",        className: "bg-green-100 text-green-800" },
      in_production:     { label: "В работе",      className: "bg-purple-100 text-purple-800" },
      done:              { label: "Выполнена",     className: "bg-emerald-100 text-emerald-800" },
    },
  },
  { id: "processType", title: "Тип",         type: COLUMN_TYPES.TEXT,   width: 140 },
  { id: "title",       title: "Описание",    type: COLUMN_TYPES.TEXT,   width: 280 },
  { id: "completion",  title: "Заполнено",   type: COLUMN_TYPES.TEXT,   width: 100,
    render: (value: any) => value ? `${value.percent ?? 0}%` : "—",
  },
  { id: "createdAt",   title: "Создана",     type: COLUMN_TYPES.DATE,   width: 160 },
];
