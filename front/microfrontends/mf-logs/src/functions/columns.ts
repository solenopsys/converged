import { getTableColumns } from 'front-core';
import { logsFields } from './fields';

export const logsColumns = getTableColumns(logsFields);
