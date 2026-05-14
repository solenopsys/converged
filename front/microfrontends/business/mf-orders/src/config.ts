import React from "react";
import { Badge, COLUMN_TYPES } from "front-core";
import type { Order, OrderProductionMethod } from "g-orders";

export const productionMethodLabels: Record<OrderProductionMethod, string> = {
	fdm: "FDM",
	sla: "SLA",
	sls: "SLS",
	dmls: "DMLS",
	polyjet: "PolyJet",
	cnc: "CNC",
	laser: "Laser",
	generic: "Generic",
};

export const orderStatusConfig = {
	draft: { label: "Draft", className: "bg-slate-100 text-slate-700" },
	queued: { label: "Queued", className: "bg-sky-100 text-sky-800" },
	in_progress: { label: "In Progress", className: "bg-amber-100 text-amber-800" },
	paused: { label: "Paused", className: "bg-orange-100 text-orange-800" },
	completed: { label: "Completed", className: "bg-emerald-100 text-emerald-800" },
	cancelled: { label: "Cancelled", className: "bg-zinc-100 text-zinc-700" },
	blocked: { label: "Blocked", className: "bg-rose-100 text-rose-800" },
};

const formatWeight = (value: unknown) => {
	const numeric = Number(value);
	if (!Number.isFinite(numeric) || numeric <= 0) return "-";
	return numeric >= 1000 ? `${(numeric / 1000).toFixed(1)} kg` : `${numeric} g`;
};

export const ordersColumns = [
	{
		id: "modelName",
		title: "Model",
		type: COLUMN_TYPES.TEXT,
		width: 300,
		primary: true,
		cardPrimary: true,
	},
	{
		id: "productionMethod",
		title: "Printing Type",
		type: COLUMN_TYPES.CUSTOM,
		width: 150,
		render: (value: OrderProductionMethod) =>
			React.createElement(
				Badge,
				{ variant: "outline" },
				productionMethodLabels[value] ?? value,
			),
	},
	{
		id: "status",
		title: "Status",
		type: COLUMN_TYPES.STATUS,
		width: 160,
		statusConfig: orderStatusConfig,
	},
	{
		id: "quantity",
		title: "Quantity",
		type: COLUMN_TYPES.NUMBER,
		width: 110,
	},
	{
		id: "weightGrams",
		title: "Weight",
		type: COLUMN_TYPES.CUSTOM,
		width: 120,
		render: formatWeight,
	},
	{
		id: "material",
		title: "Material",
		type: COLUMN_TYPES.TEXT,
		width: 160,
		render: (value: string | undefined, row: Order) => value ?? row.notes ?? "-",
	},
	{
		id: "requestId",
		title: "Request",
		type: COLUMN_TYPES.TEXT,
		width: 220,
		cardVisible: false,
	},
	{
		id: "updatedAt",
		title: "Updated",
		type: COLUMN_TYPES.DATE,
		width: 180,
		cardVisible: false,
	},
];
