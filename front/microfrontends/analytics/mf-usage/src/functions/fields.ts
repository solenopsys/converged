export const FIELD_TYPES = {
  TEXT: "text",
  DATE: "date",
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
  placeholder?: string;
}

export const usageFields: FieldConfig[] = [
  {
    id: "function",
    title: "Function",
    type: FIELD_TYPES.TEXT,
    tableVisible: true,
    minWidth: 220,
  },
  {
    id: "user",
    title: "User",
    type: FIELD_TYPES.TEXT,
    tableVisible: true,
    minWidth: 160,
  },
  {
    id: "date",
    title: "Date",
    type: FIELD_TYPES.DATE,
    tableVisible: true,
    width: 180,
  },
];
