import { resolveEmbeddedSurfaceMessage } from "front-core";
import { COLUMN_TYPES } from "front-core/table";

export const SURFACE_ID = "sf-team";

/**
 * Table metadata is read outside Preact — the object catalog is built before a
 * component exists — so it cannot use the translation hook. This is the same
 * synchronous catalog read the platform provides for action metadata; the key
 * itself is the fallback, which is what makes a missing translation visible
 * rather than silent.
 */
export function tr(key: string): string {
	const value = resolveEmbeddedSurfaceMessage(SURFACE_ID, key);
	return typeof value === "string" ? value : key;
}

/**
 * Roles are preset files, not rows in a table.
 *
 * So this map is a display concern only — the colour the console puts on
 * `StaffMember.role` — and the authority behind each name lives in
 * `modules/commands/presets/<name>.json`. Adding a role means adding a file,
 * a line here and a line in every locale, in that order.
 */
export const ROLE_CLASSES: Record<string, string> = {
	owner: "bg-violet-100 text-violet-800",
	manager: "bg-blue-100 text-blue-800",
	operator: "bg-emerald-100 text-emerald-800",
	viewer: "bg-zinc-200 text-zinc-600",
};

/** What wf-team-invite is allowed to hand out. `owner` is not on the list. */
export const GRANTABLE_ROLES = ["manager", "operator", "viewer"] as const;

export const INVITE_STATUSES = [
	"pending",
	"sent",
	"accepted",
	"revoked",
	"expired",
] as const;

const INVITE_CLASSES: Record<string, string> = {
	pending: "bg-amber-100 text-amber-800",
	sent: "bg-blue-100 text-blue-800",
	accepted: "bg-emerald-100 text-emerald-800",
	revoked: "bg-zinc-200 text-zinc-600",
	expired: "bg-zinc-200 text-zinc-600",
};

const CONSOLE_STATE_CLASSES: Record<string, string> = {
	active: "bg-emerald-100 text-emerald-800",
	invited: "bg-blue-100 text-blue-800",
	none: "bg-zinc-200 text-zinc-600",
};

/** `{ value: { label, className } }` in the shape the table chips expect. */
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

export const roleConfig = () => statusConfig(ROLE_CLASSES, "role");
export const inviteStatusConfig = () => statusConfig(INVITE_CLASSES, "invite");
export const consoleStateConfig = () =>
	statusConfig(CONSOLE_STATE_CLASSES, "consoleState");

export const activeConfig = () => ({
	true: {
		label: tr("active.true"),
		className: "bg-emerald-100 text-emerald-800",
	},
	false: { label: tr("active.false"), className: "bg-zinc-200 text-zinc-600" },
});

export const memberColumns = () => [
	{
		id: "name",
		title: tr("columns.name"),
		type: COLUMN_TYPES.TEXT,
		width: 220,
		primary: true,
	},
	{
		id: "email",
		title: tr("columns.email"),
		type: COLUMN_TYPES.TEXT,
		width: 240,
	},
	{
		id: "role",
		title: tr("columns.role"),
		type: COLUMN_TYPES.TEXT,
		width: 140,
		statusConfig: roleConfig(),
	},
	{
		id: "contact",
		title: tr("columns.contact"),
		type: COLUMN_TYPES.TEXT,
		width: 180,
	},
	{
		id: "active",
		title: tr("columns.status"),
		type: COLUMN_TYPES.TEXT,
		width: 120,
		statusConfig: activeConfig(),
	},
	{
		id: "createdAt",
		title: tr("columns.added"),
		type: COLUMN_TYPES.DATE,
		width: 160,
	},
];

export const inviteColumns = () => [
	{
		id: "email",
		title: tr("columns.address"),
		type: COLUMN_TYPES.TEXT,
		width: 240,
		primary: true,
	},
	{
		id: "name",
		title: tr("columns.name"),
		type: COLUMN_TYPES.TEXT,
		width: 200,
	},
	{
		id: "status",
		title: tr("columns.delivery"),
		type: COLUMN_TYPES.TEXT,
		width: 140,
		statusConfig: inviteStatusConfig(),
	},
	{
		id: "preset",
		title: tr("columns.role"),
		type: COLUMN_TYPES.TEXT,
		width: 140,
		statusConfig: roleConfig(),
	},
	{
		id: "invitedBy",
		title: tr("columns.invitedBy"),
		type: COLUMN_TYPES.TEXT,
		width: 180,
	},
	{
		id: "sentAt",
		title: tr("columns.sent"),
		type: COLUMN_TYPES.DATE,
		width: 160,
	},
	{
		id: "expiresAt",
		title: tr("columns.expires"),
		type: COLUMN_TYPES.DATE,
		width: 160,
	},
];

export const shiftColumns = () => [
	{
		id: "startAt",
		title: tr("columns.from"),
		type: COLUMN_TYPES.DATE,
		width: 180,
		primary: true,
	},
	{ id: "endAt", title: tr("columns.to"), type: COLUMN_TYPES.DATE, width: 180 },
	{
		id: "staffId",
		title: tr("columns.who"),
		type: COLUMN_TYPES.TEXT,
		width: 220,
	},
	{
		id: "workId",
		title: tr("columns.work"),
		type: COLUMN_TYPES.TEXT,
		width: 180,
	},
	{
		id: "note",
		title: tr("columns.note"),
		type: COLUMN_TYPES.TEXT,
		width: 320,
	},
];

/**
 * The rights projection.
 *
 * Composed in the browser out of the roster and the invitations, because the
 * service that actually knows the answer — `rp-access` — cannot be asked from
 * here at all. What it shows is therefore the intent of record (the role a
 * person was given, and the group tags that came with it), not a reading of
 * their live token.
 */
export const accessColumns = () => [
	{
		id: "name",
		title: tr("columns.person"),
		type: COLUMN_TYPES.TEXT,
		width: 220,
		primary: true,
	},
	{
		id: "email",
		title: tr("columns.email"),
		type: COLUMN_TYPES.TEXT,
		width: 240,
	},
	{
		id: "preset",
		title: tr("columns.rolePreset"),
		type: COLUMN_TYPES.TEXT,
		width: 150,
		statusConfig: roleConfig(),
	},
	{
		id: "tags",
		title: tr("columns.groupTags"),
		type: COLUMN_TYPES.TEXT,
		width: 220,
	},
	{
		id: "state",
		title: tr("columns.console"),
		type: COLUMN_TYPES.TEXT,
		width: 150,
		statusConfig: consoleStateConfig(),
	},
];
