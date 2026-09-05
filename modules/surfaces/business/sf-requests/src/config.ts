import { COLUMN_TYPES } from "front-core/table";

export const requestsColumns = [
	{
		id: "id",
		title: "ID",
		type: COLUMN_TYPES.TEXT,
		width: 220,
		primary: true,
	},
	{
		id: "status",
		title: "Status",
		type: COLUMN_TYPES.TEXT,
		width: 140,
		statusConfig: {
			new: {
				label: "New",
				className: "bg-blue-100 text-blue-800",
			},
			draft: {
				label: "Draft",
				className: "bg-gray-100 text-gray-700",
			},
			needs_clarification: {
				label: "Needs clarification",
				className: "bg-yellow-100 text-yellow-800",
			},
			ready: {
				label: "Ready",
				className: "bg-green-100 text-green-800",
			},
			in_production: {
				label: "In production",
				className: "bg-purple-100 text-purple-800",
			},
			done: {
				label: "Done",
				className: "bg-emerald-100 text-emerald-800",
			},
		},
	},
	{
		id: "processType",
		title: "Type",
		type: COLUMN_TYPES.TEXT,
		width: 140,
	},
	{
		id: "title",
		title: "Description",
		type: COLUMN_TYPES.TEXT,
		width: 280,
	},
	{
		id: "completion",
		title: "Completion",
		type: COLUMN_TYPES.TEXT,
		width: 100,
		render: (value: { percent?: number } | null | undefined) =>
			value ? `${value.percent ?? 0}%` : "—",
	},
	{
		id: "createdAt",
		title: "Created",
		type: COLUMN_TYPES.DATE,
		width: 160,
	},
];
