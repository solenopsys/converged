import { resolveEmbeddedSurfaceMessage } from "front-core";
import { COLUMN_TYPES } from "front-core/table";

export const SURFACE_ID = "sf-support";

export function tr(key: string): string {
	const value = resolveEmbeddedSurfaceMessage(SURFACE_ID, key);
	return typeof value === "string" ? value : key;
}

export const TICKET_TYPES = ["bug", "feature"] as const;

export const TICKET_STATUSES = [
	"open",
	"planned",
	"in_progress",
	"done",
	"rejected",
] as const;

const TYPE_CLASSES: Record<string, string> = {
	bug: "bg-rose-100 text-rose-800",
	feature: "bg-blue-100 text-blue-800",
};

/**
 * Five states, and the colour says how far along, not how urgent.
 *
 * There is no priority field by design: a feature's priority is its rating,
 * and "we are taking this" is the status `planned`. Colouring by urgency would
 * put back the field the model left out.
 */
const STATUS_CLASSES: Record<string, string> = {
	open: "bg-zinc-200 text-zinc-600",
	planned: "bg-amber-100 text-amber-800",
	in_progress: "bg-blue-100 text-blue-800",
	done: "bg-emerald-100 text-emerald-800",
	rejected: "bg-zinc-200 text-zinc-500",
};

export { STATUS_CLASSES, TYPE_CLASSES };

function statusConfig(
	classes: Record<string, string>,
	prefix: string,
): Record<string, { label: string; className: string }> {
	const config: Record<string, { label: string; className: string }> = {};
	for (const [value, className] of Object.entries(classes)) {
		config[value] = { label: tr(`${prefix}.${value}`), className };
	}
	return config;
}

export const typeConfig = () => statusConfig(TYPE_CLASSES, "type");
export const ticketStatusConfig = () => statusConfig(STATUS_CLASSES, "status");

export const ticketColumns = () => [
	{
		id: "number",
		title: tr("columns.number"),
		type: COLUMN_TYPES.NUMBER,
		width: 90,
		primary: true,
	},
	{
		id: "title",
		title: tr("columns.title"),
		type: COLUMN_TYPES.TEXT,
		width: 420,
	},
	{
		id: "type",
		title: tr("columns.type"),
		type: COLUMN_TYPES.TEXT,
		width: 120,
		statusConfig: typeConfig(),
	},
	{
		id: "status",
		title: tr("columns.status"),
		type: COLUMN_TYPES.TEXT,
		width: 140,
		statusConfig: ticketStatusConfig(),
	},
	{
		id: "votes",
		title: tr("columns.votes"),
		type: COLUMN_TYPES.NUMBER,
		width: 100,
	},
	{
		id: "createdAt",
		title: tr("columns.created"),
		type: COLUMN_TYPES.DATE,
		width: 170,
	},
];

/**
 * The rating table drops the type column — every row is a feature — and leads
 * with the score, because that is what the table is sorted and read by.
 */
export const ratingColumns = () => [
	{
		id: "votes",
		title: tr("columns.votes"),
		type: COLUMN_TYPES.NUMBER,
		width: 100,
		primary: true,
	},
	{
		id: "number",
		title: tr("columns.number"),
		type: COLUMN_TYPES.NUMBER,
		width: 90,
	},
	{
		id: "title",
		title: tr("columns.title"),
		type: COLUMN_TYPES.TEXT,
		width: 460,
	},
	{
		id: "status",
		title: tr("columns.status"),
		type: COLUMN_TYPES.TEXT,
		width: 140,
		statusConfig: ticketStatusConfig(),
	},
	{
		id: "createdAt",
		title: tr("columns.created"),
		type: COLUMN_TYPES.DATE,
		width: 170,
	},
];
