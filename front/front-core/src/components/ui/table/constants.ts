// Типы колонок для таблиц
export const COLUMN_TYPES = {
  TEXT: 'text',
  NUMBER: 'number',
  DATE: 'date',
  BOOLEAN: 'boolean',
  STATUS: 'status',
  TAGS: 'tags',
  IMAGE: 'image',
  LINK: 'link',
  ACTIONS: 'actions',
  CUSTOM: 'custom'
} as const;

export type ColumnType = typeof COLUMN_TYPES[keyof typeof COLUMN_TYPES];
