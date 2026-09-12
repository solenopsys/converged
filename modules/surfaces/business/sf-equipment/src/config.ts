import { COLUMN_TYPES } from "front-core/table";

/** Machine status, in the words the floor uses, with the colour it earns. */
export const machineStatusConfig = {
	running: { label: "Running", className: "bg-emerald-100 text-emerald-800" },
	idle: { label: "Idle", className: "bg-gray-100 text-gray-700" },
	maintenance: {
		label: "Maintenance",
		className: "bg-amber-100 text-amber-800",
	},
	error: { label: "Error", className: "bg-rose-100 text-rose-800" },
	offline: { label: "Offline", className: "bg-zinc-200 text-zinc-600" },
};

export const machineColumns = [
	{
		id: "name",
		title: "Machine",
		type: COLUMN_TYPES.TEXT,
		width: 220,
		primary: true,
	},
	{
		id: "status",
		title: "Status",
		type: COLUMN_TYPES.TEXT,
		width: 140,
		statusConfig: machineStatusConfig,
	},
	{ id: "kind", title: "Kind", type: COLUMN_TYPES.TEXT, width: 140 },
	{ id: "jobId", title: "Job", type: COLUMN_TYPES.TEXT, width: 200 },
	{ id: "location", title: "Location", type: COLUMN_TYPES.TEXT, width: 160 },
	{
		id: "serialNumber",
		title: "Serial",
		type: COLUMN_TYPES.TEXT,
		width: 160,
	},
	{
		id: "lastMaintenanceAt",
		title: "Last service",
		type: COLUMN_TYPES.DATE,
		width: 160,
	},
];

export const logSeverityConfig = {
	info: { label: "Info", className: "bg-gray-100 text-gray-700" },
	warning: { label: "Warning", className: "bg-amber-100 text-amber-800" },
	error: { label: "Error", className: "bg-rose-100 text-rose-800" },
	critical: { label: "Critical", className: "bg-rose-200 text-rose-900" },
};

export const logColumns = [
	{
		id: "createdAt",
		title: "When",
		type: COLUMN_TYPES.DATE,
		width: 170,
		primary: true,
	},
	{
		id: "severity",
		title: "Severity",
		type: COLUMN_TYPES.TEXT,
		width: 120,
		statusConfig: logSeverityConfig,
	},
	{ id: "eventType", title: "Event", type: COLUMN_TYPES.TEXT, width: 150 },
	{ id: "equipmentId", title: "Machine", type: COLUMN_TYPES.TEXT, width: 200 },
	{
		id: "description",
		title: "Description",
		type: COLUMN_TYPES.TEXT,
		width: 380,
	},
	{ id: "jobId", title: "Job", type: COLUMN_TYPES.TEXT, width: 180 },
];

export const slotStatusConfig = {
	planned: { label: "Planned", className: "bg-blue-100 text-blue-800" },
	in_progress: {
		label: "In progress",
		className: "bg-emerald-100 text-emerald-800",
	},
	completed: { label: "Completed", className: "bg-gray-100 text-gray-700" },
	cancelled: { label: "Cancelled", className: "bg-zinc-200 text-zinc-600" },
};

export const slotColumns = [
	{
		id: "startAt",
		title: "Starts",
		type: COLUMN_TYPES.DATE,
		width: 170,
		primary: true,
	},
	{ id: "endAt", title: "Ends", type: COLUMN_TYPES.DATE, width: 170 },
	{
		id: "status",
		title: "Status",
		type: COLUMN_TYPES.TEXT,
		width: 140,
		statusConfig: slotStatusConfig,
	},
	{ id: "equipmentId", title: "Machine", type: COLUMN_TYPES.TEXT, width: 200 },
	{ id: "orderId", title: "Order", type: COLUMN_TYPES.TEXT, width: 200 },
	{ id: "note", title: "Note", type: COLUMN_TYPES.TEXT, width: 280 },
];

/** Statuses in the order the floor reads them: working, free, then trouble. */
export const STATUS_ORDER = [
	"running",
	"idle",
	"maintenance",
	"error",
	"offline",
] as const;
