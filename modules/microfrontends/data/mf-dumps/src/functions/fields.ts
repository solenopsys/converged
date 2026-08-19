export const FIELD_TYPES = {
  TEXT: 'text',
  NUMBER: 'number',
  DATE: 'date',
} as const;

export function formatSize(bytes: number): string {
  if (bytes == null) return '—';
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}

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
    tableRender: (value: any) => formatSize(value),
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
    tableRender: (value: any) => formatSize(value),
  },
  {
    id: 'name',
    title: 'Storage',
    type: FIELD_TYPES.TEXT,
    tableVisible: true,
    minWidth: 200,
  },
];
