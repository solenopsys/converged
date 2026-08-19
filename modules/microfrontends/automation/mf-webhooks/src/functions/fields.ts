export const FIELD_TYPES = {
  TEXT: "text",
  NUMBER: "number",
  DATE: "date",
  SELECT: "select",
  TEXTAREA: "textarea",
  BOOLEAN: "boolean",
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
  defaultValue?: any;
  tableRender?: (value: any, rowData: any) => any;
}

export const endpointFields: FieldConfig[] = [
  {
    id: "id",
    title: "Endpoint",
    type: FIELD_TYPES.TEXT,
    tableVisible: true,
    formVisible: true,
    readonly: true,
    minWidth: 220,
    tableRender: (value) => `/services/webhooks/incoming/${value}`,
  },
  {
    id: "name",
    title: "Name",
    type: FIELD_TYPES.TEXT,
    tableVisible: true,
    formVisible: true,
    minWidth: 200,
    required: true,
    placeholder: "Delivery updates",
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
    id: "enabled",
    title: "Enabled",
    type: FIELD_TYPES.BOOLEAN,
    tableVisible: true,
    formVisible: true,
    width: 120,
    defaultValue: true,
  },
  {
    id: "params",
    title: "Params",
    type: FIELD_TYPES.TEXTAREA,
    tableVisible: false,
    formVisible: true,
    placeholder: "{\"secret\":\"value\"}",
    rows: 4,
    helpText: "JSON parameters for provider configuration",
  },
  {
    id: "createdAt",
    title: "Created",
    type: FIELD_TYPES.DATE,
    tableVisible: true,
    formVisible: true,
    readonly: true,
    width: 180,
  },
  {
    id: "updatedAt",
    title: "Updated",
    type: FIELD_TYPES.DATE,
    tableVisible: false,
    formVisible: true,
    readonly: true,
    width: 180,
  },
];

export const logFields: FieldConfig[] = [
  {
    id: "createdAt",
    title: "Timestamp",
    type: FIELD_TYPES.DATE,
    tableVisible: true,
    width: 180,
  },
  {
    id: "endpointId",
    title: "Endpoint",
    type: FIELD_TYPES.TEXT,
    tableVisible: true,
    minWidth: 200,
    tableRender: (value) => `/services/webhooks/incoming/${value}`,
  },
  {
    id: "provider",
    title: "Provider",
    type: FIELD_TYPES.TEXT,
    tableVisible: true,
    minWidth: 160,
  },
  {
    id: "method",
    title: "Method",
    type: FIELD_TYPES.TEXT,
    tableVisible: true,
    width: 100,
  },
  {
    id: "status",
    title: "Status",
    type: FIELD_TYPES.NUMBER,
    tableVisible: true,
    width: 90,
  },
  {
    id: "path",
    title: "Path",
    type: FIELD_TYPES.TEXT,
    tableVisible: true,
    minWidth: 220,
  },
  {
    id: "error",
    title: "Error",
    type: FIELD_TYPES.TEXT,
    tableVisible: true,
    minWidth: 200,
  },
];
