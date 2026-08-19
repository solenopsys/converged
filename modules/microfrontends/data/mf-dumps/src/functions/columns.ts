import { getTableColumns } from 'front-core';
import { dumpsFields, storagesFields } from './fields';

export const dumpsColumns = getTableColumns(dumpsFields);
export const storagesColumns = getTableColumns(storagesFields);
