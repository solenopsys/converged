export const FIELD_TYPES = {
  TEXT: 'text',
  NUMBER: 'number',
  DATE: 'date',
  SELECT: 'select',
  TEXTAREA: 'textarea',
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

export const workflowsFields: FieldConfig[] = [
  {
    id: 'name',
    title: 'Name',
    type: FIELD_TYPES.TEXT,
    tableVisible: true,
    formVisible: true,
    minWidth: 200,
    required: true,
    placeholder: 'Enter workflow name...',
  },
  {
    id: 'description',
    title: 'Description',
    type: FIELD_TYPES.TEXTAREA,
    tableVisible: true,
    formVisible: true,
    minWidth: 300,
    placeholder: 'Enter description...',
    rows: 3,
  },
  {
    id: 'nodesCount',
    title: 'Nodes',
    type: FIELD_TYPES.NUMBER,
    tableVisible: true,
    formVisible: false,
    width: 100,
  },
];

export const nodesFields: FieldConfig[] = [
  {
    id: 'name',
    title: 'Name',
    type: FIELD_TYPES.TEXT,
    tableVisible: true,
    formVisible: true,
    minWidth: 200,
    required: true,
    placeholder: 'Enter node name...',
  },
  {
    id: 'codeSource',
    title: 'Code Source',
    type: FIELD_TYPES.SELECT,
    tableVisible: true,
    formVisible: true,
    minWidth: 200,
    required: true,
    placeholder: 'Select code source...',
    options: [],
  },
  {
    id: 'description',
    title: 'Description',
    type: FIELD_TYPES.TEXTAREA,
    tableVisible: false,
    formVisible: true,
    placeholder: 'Enter description...',
    rows: 3,
  },
];

export const providersFields: FieldConfig[] = [
  {
    id: 'name',
    title: 'Name',
    type: FIELD_TYPES.TEXT,
    tableVisible: true,
    formVisible: true,
    minWidth: 200,
    required: true,
    placeholder: 'Enter provider name...',
  },
  {
    id: 'codeSource',
    title: 'Code Source',
    type: FIELD_TYPES.SELECT,
    tableVisible: true,
    formVisible: true,
    minWidth: 200,
    required: true,
    placeholder: 'Select code source...',
    options: [],
  },
  {
    id: 'description',
    title: 'Description',
    type: FIELD_TYPES.TEXTAREA,
    tableVisible: false,
    formVisible: true,
    placeholder: 'Enter description...',
    rows: 3,
  },
];
