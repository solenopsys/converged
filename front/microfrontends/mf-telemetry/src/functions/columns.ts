import { getTableColumns } from 'front-core';
import { telemetryFields } from './fields';

export const telemetryColumns = getTableColumns(telemetryFields);
