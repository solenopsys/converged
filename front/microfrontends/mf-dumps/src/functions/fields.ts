export const FIELD_TYPES = {
  TEXT: 'text',
  NUMBER: 'number',
  DATE: 'date',
} as const;

export const storagesFields = [
  {
    id: 'name',
    title: 'Storage',
    type: FIELD_TYPES.TEXT,
    tableVisible: true,
    minWidth: 220,
  },
  {
    id: 'size',
    title: 'Size',
    type: FIELD_TYPES.NUMBER,
    tableVisible: true,
    width: 140,
  },
];

export const dumpsFields = [
  {
    id: 'fileName',
    title: 'File',
    type: FIELD_TYPES.TEXT,
    tableVisible: true,
    minWidth: 260,
  },
  {
    id: 'size',
    title: 'Size',
    type: FIELD_TYPES.NUMBER,
    tableVisible: true,
    width: 140,
  },
  {
    id: 'name',
    title: 'Storage',
    type: FIELD_TYPES.TEXT,
    tableVisible: true,
    minWidth: 200,
  },
];
