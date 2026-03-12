export const FIELD_TYPES = {
  TEXT: 'text',
  NUMBER: 'number',
  DATE: 'date',
} as const;

export const telemetryFields = [
  {
    id: 'ts',
    title: 'Timestamp',
    type: FIELD_TYPES.DATE,
    tableVisible: true,
    width: 160,
  },
  {
    id: 'device_id',
    title: 'Device',
    type: FIELD_TYPES.TEXT,
    tableVisible: true,
    minWidth: 160,
  },
  {
    id: 'param',
    title: 'Param',
    type: FIELD_TYPES.TEXT,
    tableVisible: true,
    minWidth: 160,
  },
  {
    id: 'value',
    title: 'Value',
    type: FIELD_TYPES.NUMBER,
    tableVisible: true,
    width: 120,
  },
  {
    id: 'unit',
    title: 'Unit',
    type: FIELD_TYPES.TEXT,
    tableVisible: true,
    width: 80,
  },
];
