import { COLUMN_TYPES } from "front-core/table";

export const workflowsColumns = [
	{
		id: "name",
		title: "Workflow",
		type: COLUMN_TYPES.TEXT,
		primary: true,
		minWidth: 200,
	},
	{ id: "script", title: "Script", type: COLUMN_TYPES.TEXT, minWidth: 240 },
	{ id: "brief", title: "Brief", type: COLUMN_TYPES.TEXT, minWidth: 260 },
];

export const executionsColumns = [
	{
		id: "id",
		title: "Run",
		type: COLUMN_TYPES.TEXT,
		primary: true,
		minWidth: 200,
		width: 260,
	},
	{
		id: "workflow",
		title: "Workflow",
		type: COLUMN_TYPES.TEXT,
		minWidth: 180,
		width: 240,
	},
	{
		id: "status",
		title: "Status",
		type: COLUMN_TYPES.STATUS,
		minWidth: 100,
		width: 120,
		statusConfig: {
			done: { label: "done", variant: "success" },
			failed: { label: "failed", variant: "destructive" },
			running: { label: "running", variant: "secondary" },
		},
	},
	{
		id: "startedAt",
		title: "Started",
		type: COLUMN_TYPES.DATE,
		minWidth: 150,
		width: 180,
	},
	{
		id: "endedAt",
		title: "Ended",
		type: COLUMN_TYPES.DATE,
		minWidth: 150,
		width: 180,
	},
	{ id: "error", title: "Error", type: COLUMN_TYPES.TEXT, minWidth: 200 },
];

export const triggersColumns = [
	{
		id: "name",
		title: "Name",
		type: COLUMN_TYPES.TEXT,
		primary: true,
		minWidth: 180,
	},
	{ id: "topic", title: "Topic", type: COLUMN_TYPES.TEXT, minWidth: 200 },
	{ id: "script", title: "Workflow", type: COLUMN_TYPES.TEXT, minWidth: 200 },
	{
		id: "enabled",
		title: "Enabled",
		type: COLUMN_TYPES.STATUS,
		minWidth: 100,
		width: 120,
		statusConfig: {
			true: { label: "on", variant: "success" },
			false: { label: "off", variant: "outline" },
		},
	},
];

export const varsColumns = [
	{
		id: "key",
		title: "Key",
		type: COLUMN_TYPES.TEXT,
		primary: true,
		minWidth: 200,
		width: 300,
	},
	{
		id: "value",
		title: "Value",
		type: COLUMN_TYPES.TEXT,
		minWidth: 200,
		width: 400,
	},
];
