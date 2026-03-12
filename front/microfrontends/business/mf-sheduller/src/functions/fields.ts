export const FIELD_TYPES = {
  TEXT: "text",
  NUMBER: "number",
  DATE: "date",
  SELECT: "select",
  TEXTAREA: "textarea",
} as const;

export type FieldType = typeof FIELD_TYPES[keyof typeof FIELD_TYPES];

export interface FieldConfig {
  id: string;
  title: string;
  type: FieldType;
  tableVisible?: boolean;
  formVisible?: boolean;
  width?: number;
  minWidth?: number;
  required?: boolean;
  readonly?: boolean;
  placeholder?: string;
  rows?: number;
  options?: Array<{ value: string | number; label: string }>;
  helpText?: string;
}

export const cronsFields: FieldConfig[] = [
  {
    id: "name",
    title: "Name",
    type: FIELD_TYPES.TEXT,
    tableVisible: true,
    formVisible: true,
    minWidth: 200,
    required: true,
    placeholder: "Enter cron name...",
  },
  {
    id: "expression",
    title: "Expression",
    type: FIELD_TYPES.TEXT,
    tableVisible: true,
    formVisible: true,
    minWidth: 150,
    required: true,
    placeholder: "*/5 * * * *",
    helpText: "Cron expression (e.g., */5 * * * *)",
  },
  {
    id: "provider",
    title: "Provider",
    type: FIELD_TYPES.SELECT,
    tableVisible: true,
    formVisible: true,
    minWidth: 200,
    required: true,
    placeholder: "Select provider...",
    options: [],
  },
  {
    id: "action",
    title: "Action",
    type: FIELD_TYPES.SELECT,
    tableVisible: true,
    formVisible: true,
    minWidth: 200,
    required: true,
    placeholder: "Select action...",
    options: [],
  },
  {
    id: "params",
    title: "Params",
    type: FIELD_TYPES.TEXTAREA,
    tableVisible: false,
    formVisible: true,
    placeholder: "{\"key\":\"value\"}",
    rows: 4,
    helpText: "JSON payload for the action parameters",
  },
  {
    id: "providerSettings",
    title: "Provider Settings",
    type: FIELD_TYPES.TEXTAREA,
    tableVisible: false,
    formVisible: true,
    placeholder: "{\"baseUrl\":\"http://localhost:3001/services\"}",
    rows: 3,
    helpText: "JSON settings map for the provider",
  },
  {
    id: "status",
    title: "Status",
    type: FIELD_TYPES.SELECT,
    tableVisible: true,
    formVisible: true,
    width: 100,
    options: [
      { value: "active", label: "Active" },
      { value: "paused", label: "Paused" },
    ],
  },
];
