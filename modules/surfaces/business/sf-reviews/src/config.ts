import { COLUMN_TYPES } from "front-core/table";

/** Where a review stands, in the words moderation uses. */
export const reviewStatusConfig = {
	pending: { label: "On moderation", className: "bg-amber-100 text-amber-800" },
	published: {
		label: "Published",
		className: "bg-emerald-100 text-emerald-800",
	},
	rejected: { label: "Rejected", className: "bg-zinc-200 text-zinc-600" },
};

export const reviewSourceConfig = {
	site: { label: "Site", className: "bg-gray-100 text-gray-700" },
	invite: { label: "Invitation", className: "bg-blue-100 text-blue-800" },
	staff: { label: "Entered by staff", className: "bg-gray-100 text-gray-700" },
	external: { label: "External", className: "bg-violet-100 text-violet-800" },
};

export const reviewColumns = [
	{
		id: "createdAt",
		title: "Received",
		type: COLUMN_TYPES.DATE,
		width: 160,
		primary: true,
	},
	{ id: "rating", title: "Rating", type: COLUMN_TYPES.TEXT, width: 90 },
	{
		id: "status",
		title: "Status",
		type: COLUMN_TYPES.TEXT,
		width: 150,
		statusConfig: reviewStatusConfig,
	},
	{ id: "author", title: "Author", type: COLUMN_TYPES.TEXT, width: 180 },
	{ id: "text", title: "Review", type: COLUMN_TYPES.TEXT, width: 420 },
	{ id: "orderId", title: "Order", type: COLUMN_TYPES.TEXT, width: 180 },
	{
		id: "source",
		title: "Source",
		type: COLUMN_TYPES.TEXT,
		width: 140,
		statusConfig: reviewSourceConfig,
	},
	{ id: "reply", title: "Answer", type: COLUMN_TYPES.TEXT, width: 280 },
	{
		id: "externalPlatform",
		title: "Shared on",
		type: COLUMN_TYPES.TEXT,
		width: 140,
	},
];

export const inviteStatusConfig = {
	queued: { label: "Queued", className: "bg-gray-100 text-gray-700" },
	sent: { label: "Sent", className: "bg-blue-100 text-blue-800" },
	opened: { label: "Opened", className: "bg-indigo-100 text-indigo-800" },
	answered: { label: "Answered", className: "bg-emerald-100 text-emerald-800" },
	expired: { label: "Expired", className: "bg-zinc-200 text-zinc-600" },
	failed: { label: "Failed", className: "bg-rose-100 text-rose-800" },
};

export const inviteColumns = [
	{
		id: "createdAt",
		title: "Created",
		type: COLUMN_TYPES.DATE,
		width: 160,
		primary: true,
	},
	{
		id: "status",
		title: "Status",
		type: COLUMN_TYPES.TEXT,
		width: 130,
		statusConfig: inviteStatusConfig,
	},
	{ id: "contact", title: "Sent to", type: COLUMN_TYPES.TEXT, width: 220 },
	{ id: "orderId", title: "Order", type: COLUMN_TYPES.TEXT, width: 180 },
	{ id: "sentAt", title: "Sent", type: COLUMN_TYPES.DATE, width: 160 },
	{ id: "openedAt", title: "Opened", type: COLUMN_TYPES.DATE, width: 160 },
	{
		id: "followupCount",
		title: "Chased",
		type: COLUMN_TYPES.TEXT,
		width: 100,
	},
	{ id: "expiresAt", title: "Expires", type: COLUMN_TYPES.DATE, width: 160 },
];

/** Queue first: the only column of this screen that needs somebody today. */
export const STATUS_ORDER = ["pending", "published", "rejected"] as const;
