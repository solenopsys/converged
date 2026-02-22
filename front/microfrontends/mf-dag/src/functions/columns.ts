import { COLUMN_TYPES } from 'front-core';

export const contextsColumns = [
  {
    id: 'id',
    title: 'ID',
    type: COLUMN_TYPES.TEXT,
    primary: true,
    minWidth: 200,
    width: 300,
  },
  {
    id: 'workflowName',
    title: 'Workflow',
    type: COLUMN_TYPES.TEXT,
    minWidth: 150,
    width: 200,
  },
  {
    id: 'status',
    title: 'Status',
    type: COLUMN_TYPES.STATUS,
    minWidth: 100,
    width: 120,
  },
  {
    id: 'startedAt',
    title: 'Started',
    type: COLUMN_TYPES.DATE,
    minWidth: 150,
    width: 180,
  },
  {
    id: 'updatedAt',
    title: 'Updated',
    type: COLUMN_TYPES.DATE,
    minWidth: 150,
    width: 180,
  },
];

export const tasksColumns = [
  {
    id: 'id',
    title: 'ID',
    type: COLUMN_TYPES.TEXT,
    primary: true,
    minWidth: 80,
    width: 100,
  },
  {
    id: 'nodeId',
    title: 'Node',
    type: COLUMN_TYPES.TEXT,
    minWidth: 150,
    width: 200,
  },
  {
    id: 'state',
    title: 'State',
    type: COLUMN_TYPES.STATUS,
    minWidth: 100,
    width: 120,
    statusConfig: {
      done: { label: 'done', variant: 'success' },
      failed: { label: 'failed', variant: 'destructive' },
      processing: { label: 'processing', variant: 'secondary' },
      queued: { label: 'queued', variant: 'outline' },
    },
  },
  {
    id: 'startedAt',
    title: 'Started',
    type: COLUMN_TYPES.DATE,
    minWidth: 150,
    width: 180,
  },
  {
    id: 'completedAt',
    title: 'Completed',
    type: COLUMN_TYPES.DATE,
    minWidth: 150,
    width: 180,
  },
  {
    id: 'retryCount',
    title: 'Retries',
    type: COLUMN_TYPES.TEXT,
    minWidth: 80,
    width: 100,
  },
  {
    id: 'errorMessage',
    title: 'Error',
    type: COLUMN_TYPES.TEXT,
    minWidth: 200,
    width: 300,
  },
];

export const executionsColumns = [
  {
    id: 'id',
    title: 'ID',
    type: COLUMN_TYPES.TEXT,
    primary: true,
    minWidth: 200,
    width: 300,
  },
  {
    id: 'workflowName',
    title: 'Workflow',
    type: COLUMN_TYPES.TEXT,
    minWidth: 150,
    width: 200,
  },
  {
    id: 'status',
    title: 'Status',
    type: COLUMN_TYPES.STATUS,
    minWidth: 100,
    width: 120,
    statusConfig: {
      done: { label: 'done', variant: 'success' },
      failed: { label: 'failed', variant: 'destructive' },
      running: { label: 'running', variant: 'secondary' },
    },
  },
  {
    id: 'startedAt',
    title: 'Started',
    type: COLUMN_TYPES.DATE,
    minWidth: 150,
    width: 180,
  },
  {
    id: 'updatedAt',
    title: 'Updated',
    type: COLUMN_TYPES.DATE,
    minWidth: 150,
    width: 180,
  },
];
