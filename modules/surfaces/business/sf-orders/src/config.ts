import { Badge, resolveEmbeddedSurfaceMessage } from "front-core";
import { COLUMN_TYPES } from "front-core/table";
import type { Order, OrderProductionMethod, OrderStatus } from "g-orders";
import React from "preact/compat";

export const SURFACE_ID = "sf-orders";

/**
 * Table metadata is read outside Preact — the object catalog is built before a
 * component exists — so it cannot use the translation hook. The key itself is
 * the fallback, which is what makes a missing translation visible rather than
 * silent.
 */
export function tr(key: string): string {
	const value = resolveEmbeddedSurfaceMessage(SURFACE_ID, key);
	return typeof value === "string" ? value : key;
}

/** Every method `rp-orders` knows, in contract order. */
export const PRODUCTION_METHODS: readonly OrderProductionMethod[] = [
	"fdm",
	"sla",
	"sls",
	"dmls",
	"polyjet",
	"cnc",
	"laser",
	"generic",
];

export const ORDER_STATUSES: readonly OrderStatus[] = [
	"draft",
	"queued",
	"in_progress",
	"paused",
	"completed",
	"cancelled",
	"blocked",
];

const STATUS_CLASSES: Record<OrderStatus, string> = {
	draft: "bg-slate-100 text-slate-700",
	queued: "bg-sky-100 text-sky-800",
	in_progress: "bg-amber-100 text-amber-800",
	paused: "bg-orange-100 text-orange-800",
	completed: "bg-emerald-100 text-emerald-800",
	cancelled: "bg-zinc-100 text-zinc-700",
	blocked: "bg-rose-100 text-rose-800",
};

export const methodLabel = (method: string): string =>
	tr(`method.${method}`) === `method.${method}`
		? method
		: tr(`method.${method}`);

/** `{ value: { label, className } }` in the shape the table chips expect. */
export const orderStatusConfig = (): Record<
	string,
	{ label: string; className: string }
> =>
	Object.fromEntries(
		ORDER_STATUSES.map((status) => [
			status,
			{ label: tr(`status.${status}`), className: STATUS_CLASSES[status] },
		]),
	);

export const statusOptions = () =>
	ORDER_STATUSES.map((status) => ({
		value: status,
		label: tr(`status.${status}`),
	}));

export const methodOptions = () =>
	PRODUCTION_METHODS.map((method) => ({
		value: method,
		label: methodLabel(method),
	}));

const formatWeight = (value: unknown) => {
	const numeric = Number(value);
	if (!Number.isFinite(numeric) || numeric <= 0) return "-";
	return numeric >= 1000 ? `${(numeric / 1000).toFixed(1)} kg` : `${numeric} g`;
};

export const ordersColumns = () => [
	{
		id: "modelName",
		title: tr("columns.model"),
		type: COLUMN_TYPES.TEXT,
		width: 300,
		primary: true,
		cardPrimary: true,
	},
	{
		id: "productionMethod",
		title: tr("columns.method"),
		type: COLUMN_TYPES.CUSTOM,
		width: 150,
		render: (value: OrderProductionMethod) =>
			React.createElement(Badge, { variant: "outline" }, methodLabel(value)),
	},
	{
		id: "status",
		title: tr("columns.status"),
		type: COLUMN_TYPES.STATUS,
		width: 160,
		statusConfig: orderStatusConfig(),
	},
	{
		id: "quantity",
		title: tr("columns.quantity"),
		type: COLUMN_TYPES.NUMBER,
		width: 110,
	},
	{
		id: "weightGrams",
		title: tr("columns.weight"),
		type: COLUMN_TYPES.CUSTOM,
		width: 120,
		render: formatWeight,
	},
	{
		id: "material",
		title: tr("columns.material"),
		type: COLUMN_TYPES.TEXT,
		width: 160,
		render: (value: string | undefined, row: Order) =>
			value ?? row.notes ?? "-",
	},
	// The two columns the queue exists for: what machine it is on and when it is
	// owed. Without them the table is a list of orders rather than a plan.
	{
		id: "equipmentId",
		title: tr("columns.machine"),
		type: COLUMN_TYPES.TEXT,
		width: 160,
		render: (value: string | undefined) => value ?? tr("detail.unassigned"),
	},
	{
		id: "dueAt",
		title: tr("columns.due"),
		type: COLUMN_TYPES.DATE,
		width: 150,
	},
	{
		id: "requestId",
		title: tr("columns.request"),
		type: COLUMN_TYPES.TEXT,
		width: 220,
		cardVisible: false,
	},
	{
		id: "updatedAt",
		title: tr("columns.updated"),
		type: COLUMN_TYPES.DATE,
		width: 180,
		cardVisible: false,
	},
];
