export const FIELD_TYPES = {
  TEXT: 'text',
  NUMBER: 'number',
  DATE: 'date',
} as const;

export const logsFields = [
  {
    id: 'ts',
    title: 'Timestamp',
    type: FIELD_TYPES.DATE,
    tableVisible: true,
    width: 160,
  },
  {
    id: 'source',
    title: 'Source',
    type: FIELD_TYPES.TEXT,
    tableVisible: true,
    minWidth: 160,
  },
  {
    id: 'level',
    title: 'Level',
    type: FIELD_TYPES.NUMBER,
    tableVisible: true,
    width: 80,
  },
  {
    id: 'code',
    title: 'Code',
    type: FIELD_TYPES.NUMBER,
    tableVisible: true,
    width: 80,
  },
  {
    id: 'message',
    title: 'Message',
    type: FIELD_TYPES.TEXT,
    tableVisible: true,
    minWidth: 320,
  },
];
