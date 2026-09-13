import { EntityListView } from "front-core";
import {
	Category,
	defineSurface,
	type ObjectDefinition,
	objectOf,
	objectRef,
	setOf,
	setRef,
} from "front-core/object-runtime";
import type { Invite, InviteListParams } from "g-identity";
import type { ShiftListParams, StaffListParams } from "g-staff";
import {
	accessColumns,
	GRANTABLE_ROLES,
	INVITE_STATUSES,
	inviteColumns,
	memberColumns,
	shiftColumns,
	tr,
} from "./config";
import { accessRows, memberChanged, teamImported } from "./domain-team";
import {
	identityClient,
	staffClient,
	TEAM_INVITE_SCRIPT,
	workflowClient,
} from "./services";
import { TeamSummary } from "./summary";
import { MemberDetailView } from "./views/MemberDetailView";
import { TeamOverviewView } from "./views/TeamOverviewView";

// The team as one working area.
//
// Four `setOf` views, which the workspace turns into the permanent buttons of
// this tab — the roster, the invitations, the schedule and the rights — and one
// `objectOf` view for a person, which opens as a closable button *inside the
// same tab*. With nothing pressed the surface shows its own screen.
//
// What shapes this file more than anything: **the console cannot grant
// anything.** `rp-access` refuses a user JWT outright (`@Access("internal")`),
// so every operation here that changes what somebody may do goes through
// wf-team-invite on centimanus, which holds the cluster's service token. That
// is not a workaround — it is where the privilege boundary is drawn, and the
// grant `wf/workflows/wf-team-invite.js(x)` in one preset file is the whole of
// "who may add people".

const ROLE_OPTIONS = () =>
	GRANTABLE_ROLES.map((role) => ({ value: role, label: tr(`role.${role}`) }));

const INVITE_STATUS_OPTIONS = () =>
	INVITE_STATUSES.map((status) => ({
		value: status,
		label: tr(`invite.${status}`),
	}));

/** The rights table is composed here, because the service that knows the answer
 *  cannot be asked from a browser. See `accessRows`. */
async function loadAccessRows(params: { offset?: number; limit?: number }) {
	const roster = await staffClient.listStaff({
		offset: params.offset ?? 0,
		limit: params.limit ?? 100,
	});
	let invites: Invite[] = [];
	try {
		const listed = await identityClient.listInvites({ offset: 0, limit: 500 });
		invites = listed.items ?? [];
	} catch {
		invites = [];
	}
	const rows = accessRows({
		members: roster.items ?? [],
		invites,
		loading: false,
	});
	return { items: rows, totalCount: roster.totalCount ?? rows.length };
}

export const objects = [
	{
		id: "team.member",
		label: "Team member",
		labelKey: "types.member.label",
		pluralLabel: "Team",
		pluralLabelKey: "menu.members",
		description:
			"One person who works here: their card, their role and whether they can sign in",
		descriptionKey: "types.member.description",
		categories: [
			Category.Business,
			Category.Selectable,
			Category.Creatable,
			Category.Editable,
		],
		selection: {
			filters: [
				{
					id: "role",
					label: tr("columns.role"),
					valueType: "string",
					operators: ["eq"],
					control: "select",
					options: ROLE_OPTIONS().map((option) => ({
						id: option.value,
						label: option.label,
					})),
				},
			],
			load: (params) => staffClient.listStaff(params as StaffListParams),
		},
		infinity: {
			tableId: "team-members",
			title: tr("menu.members"),
			columns: memberColumns(),
			load: (params) => staffClient.listStaff(params as StaffListParams),
			rowRef: (row) => {
				const member = row as { id?: unknown; name?: unknown };
				const id = String(member.id ?? "");
				return objectRef("team.member", id, {
					title:
						(typeof member.name === "string" && member.name) || `Member ${id}`,
				});
			},
			filters: [
				{
					id: "query",
					label: tr("columns.search"),
					type: "search",
					operator: "contains",
				},
				{
					id: "role",
					label: tr("columns.role"),
					type: "select",
					operator: "eq",
					options: ROLE_OPTIONS(),
				},
			],
			// Who is here now comes first; the people who left are a different
			// question and stay one click away rather than mixed in.
			presets: [
				{
					id: "team.working",
					label: tr("tabs.working"),
					control: "tab",
					group: "team-active",
					defaults: { active: true },
				},
				{
					id: "team.left",
					label: tr("tabs.left"),
					control: "tab",
					group: "team-active",
					defaults: { active: false },
				},
				{
					id: "team.all",
					label: tr("tabs.all"),
					control: "tab",
					group: "team-active",
				},
			],
			mobile: { title: "name", subtitle: "email", badge: "role" },
		},
	},
	{
		id: "team.invite",
		label: "Invitation",
		labelKey: "types.invite.label",
		pluralLabel: "Invitations",
		pluralLabelKey: "menu.invites",
		description:
			"An address that is allowed in and the role it gets on arrival, plus whether its letter landed",
		descriptionKey: "types.invite.description",
		categories: [Category.Business, Category.Selectable],
		selection: {
			filters: [],
			load: (params) => identityClient.listInvites(params as InviteListParams),
		},
		infinity: {
			tableId: "team-invites",
			title: tr("menu.invites"),
			columns: inviteColumns(),
			load: (params) => identityClient.listInvites(params as InviteListParams),
			// An invitation is not a thing to open; the person it is about is, and
			// the roster is where they live.
			rowRef: (row) => {
				const invite = row as { email?: unknown };
				return setRef("team.member", {
					kind: "query",
					filter: { query: String(invite.email ?? "") },
				});
			},
			filters: [
				{
					id: "status",
					label: tr("columns.delivery"),
					type: "select",
					operator: "eq",
					options: INVITE_STATUS_OPTIONS(),
				},
				{
					id: "email",
					label: tr("columns.address"),
					type: "search",
					operator: "eq",
				},
			],
		},
	},
	{
		id: "team.shift",
		label: "Shift",
		labelKey: "types.shift.label",
		pluralLabel: "Schedule",
		pluralLabelKey: "menu.shifts",
		description: "Who is on, when",
		descriptionKey: "types.shift.description",
		categories: [Category.Business, Category.Selectable],
		selection: {
			filters: [],
			load: (params) => staffClient.listShifts(params as ShiftListParams),
		},
		infinity: {
			tableId: "team-shifts",
			title: tr("menu.shifts"),
			columns: shiftColumns(),
			load: (params) => staffClient.listShifts(params as ShiftListParams),
			rowRef: (row) => {
				const shift = row as { staffId?: unknown };
				return objectRef("team.member", String(shift.staffId ?? ""));
			},
			filters: [
				{
					id: "staffId",
					label: tr("columns.who"),
					type: "search",
					operator: "eq",
				},
				// One control, not two: the table vocabulary has a range, and
				// `rp-staff` reads the period as `from`/`to` on its side.
				{
					id: "startAt",
					label: tr("columns.from"),
					type: "date-range",
					operator: "between",
				},
			],
		},
	},
	{
		id: "team.access",
		label: "Access",
		labelKey: "types.access.label",
		pluralLabel: "Rights",
		pluralLabelKey: "menu.access",
		description:
			"What each person was given: the role preset, the group tags, and whether they can get in",
		descriptionKey: "types.access.description",
		categories: [Category.Business, Category.Selectable],
		selection: {
			filters: [],
			load: (params) =>
				loadAccessRows(params as { offset?: number; limit?: number }),
		},
		infinity: {
			tableId: "team-access",
			title: tr("menu.access"),
			columns: accessColumns(),
			load: (params) =>
				loadAccessRows(params as { offset?: number; limit?: number }),
			rowRef: (row) => {
				const entry = row as { id?: unknown; name?: unknown };
				return objectRef("team.member", String(entry.id ?? ""), {
					title: typeof entry.name === "string" ? entry.name : undefined,
				});
			},
			filters: [],
		},
	},
	{
		id: "team.statistic.summary",
		label: "Team",
		labelKey: "menu.members",
		categories: [Category.Statistic, Category.Business],
		statistic: { role: "summary", component: TeamSummary },
	},
	{
		// The surface's own screen. A statistical type with no `component` is
		// resolved through its `setOf` view, which the shell then gives the full
		// row — so the team overview is what this tab shows when no button is
		// pressed, and a button of its own besides.
		id: "team.statistic",
		label: "Overview",
		labelKey: "menu.overview",
		pluralLabel: "Overview",
		pluralLabelKey: "menu.overview",
		categories: [Category.Statistic, Category.Business],
	},
] satisfies readonly ObjectDefinition[];

/** The one reference every card operation needs. */
function memberIdOf(references: readonly { kind: string }[]): string {
	const ref = references.find(
		(item: any) => item.kind === "object" && item.type === "team.member",
	) as { kind: string; id?: string } | undefined;
	if (ref?.kind !== "object" || !ref.id)
		throw new Error("Team member reference is required");
	return ref.id;
}

function inviteIdOf(references: readonly { kind: string }[]): string {
	const ref = references.find(
		(item: any) => item.kind === "object" && item.type === "team.invite",
	) as { kind: string; id?: string } | undefined;
	if (ref?.kind !== "object" || !ref.id)
		throw new Error("Invitation reference is required");
	return ref.id;
}

/**
 * Run wf-team-invite and hand back what it did.
 *
 * The workflow answers with a report; a refused run answers with `ok: false`
 * and a message, which is a normal outcome here — the commonest one being that
 * the caller's role has no `wf/workflows/wf-team-invite.js(x)` grant. Turning
 * that into a thrown error is what makes the screen say "you cannot do this"
 * instead of silently doing nothing.
 */
async function runTeamInvite(params: Record<string, unknown>) {
	const run = await workflowClient.runWorkflow(TEAM_INVITE_SCRIPT, params);
	if (!run.ok) throw new Error(run.error ?? tr("errors.inviteFailed"));
	return (run.result ?? {}) as {
		staffIds?: string[];
		created?: number;
		updated?: number;
		failed?: number;
		mailed?: number;
		parsed?: number;
	};
}

export default defineSurface({
	id: "sf-team",
	label: "Team",
	labelKey: "surface.label",
	purpose:
		"Who works here, what each of them may do, and who has been asked in but has not arrived yet",
	types: objects,
	views: [
		{
			id: "team.member.detail",
			accepts: objectOf("team.member"),
			component: MemberDetailView,
			props: (ref) => ({
				memberId: ref.kind === "object" ? ref.id : undefined,
			}),
		},
		{
			id: "team.member.table",
			label: "Team",
			accepts: setOf("team.member"),
			component: EntityListView,
		},
		{
			id: "team.invite.table",
			label: "Invitations",
			accepts: setOf("team.invite"),
			component: EntityListView,
		},
		{
			id: "team.shift.table",
			label: "Schedule",
			accepts: setOf("team.shift"),
			component: EntityListView,
		},
		{
			id: "team.access.table",
			label: "Rights",
			accepts: setOf("team.access"),
			component: EntityListView,
		},
		{
			id: "team.statistic.dashboard",
			label: "Overview",
			accepts: setOf("team.statistic"),
			component: TeamOverviewView,
		},
	],
	operations: [
		{
			// The one this whole contour exists for: a list goes in, a filled
			// table of exactly those people comes out.
			id: "team.member.import",
			operator: "create",
			target: "team.member",
			label: "Add people from a list",
			labelKey: "operations.member_import.label",
			description:
				"Paste a list of people — name and email, in any shape — or name uploaded files. Everyone gets an account, the role you choose, a staff card and a sign-in link. Running the same list twice adds nobody twice.",
			descriptionKey: "operations.member_import.description",
			output: setOf("team.member"),
			parameters: {
				type: "object",
				properties: {
					rawText: {
						type: "string",
						description: "The pasted list itself",
					},
					fileIds: {
						type: "array",
						items: { type: "string" },
						description: "rp-files ids of uploaded lists",
					},
					preset: {
						type: "string",
						enum: [...GRANTABLE_ROLES],
						description: "Role for everyone in this list",
					},
					tags: {
						type: "array",
						items: { type: "string" },
						description: "Group access tags, e.g. team-ops",
					},
					dryRun: {
						type: "boolean",
						description: "Report what would happen and change nothing",
					},
				},
			},
			presentOutput: true,
			invoke: async ({ params }) => {
				const report = await runTeamInvite({
					...(params.rawText ? { rawText: String(params.rawText) } : {}),
					...(Array.isArray(params.fileIds) ? { fileIds: params.fileIds } : {}),
					...(params.preset ? { preset: String(params.preset) } : {}),
					...(Array.isArray(params.tags) ? { tags: params.tags } : {}),
					...(params.dryRun ? { dryRun: true } : {}),
				});
				const ids = report.staffIds ?? [];
				teamImported({ staffIds: ids });
				// The set of ids, not a sentence: the runtime opens a table of
				// exactly these people beside the invitations projection.
				return setRef(
					"team.member",
					{ kind: "ids", ids },
					{
						title: tr("errors.imported").replace("{count}", String(ids.length)),
					},
				);
			},
		},
		{
			// Somebody who works here but does not need the console — a card
			// without an account. No role, so nothing to escalate, so no workflow.
			id: "team.member.create",
			operator: "create",
			target: "team.member",
			label: "Add one person",
			labelKey: "operations.member_create.label",
			description:
				"File a card for somebody who works here. This does not give them console access — use the import for that.",
			descriptionKey: "operations.member_create.description",
			output: objectOf("team.member"),
			parameters: {
				type: "object",
				properties: {
					name: { type: "string" },
					email: { type: "string" },
					contact: {
						type: "string",
						description: "Phone, messenger, whatever",
					},
					role: { type: "string" },
				},
				required: ["name"],
			},
			presentOutput: true,
			invoke: async ({ params }) => {
				const id = await staffClient.createStaff({
					name: String(params.name),
					...(params.email ? { email: String(params.email) } : {}),
					...(params.contact ? { contact: String(params.contact) } : {}),
					...(params.role ? { role: String(params.role) } : {}),
					active: true,
				});
				return objectRef("team.member", id, { title: String(params.name) });
			},
		},
		{
			id: "team.member.save",
			operator: "save",
			target: "team.member",
			label: "Save card",
			labelKey: "operations.member_save.label",
			inputs: [{ name: "member", accepts: objectOf("team.member") }],
			parameters: {
				type: "object",
				properties: {
					name: { type: "string" },
					email: { type: "string" },
					contact: { type: "string" },
					lang: { type: "string" },
				},
			},
			invoke: async ({ references, params }) => {
				const id = memberIdOf(references);
				await staffClient.updateStaff(id, params as any);
				const member = await staffClient.getStaff(id);
				if (member) memberChanged(member);
				return member;
			},
		},
		{
			// A role is a preset, and presets are handed out by the workflow —
			// this screen has no way to link one and should not grow one.
			id: "team.member.setRole",
			operator: "execute",
			target: "team.member",
			label: "Change role",
			labelKey: "operations.member_setRole.label",
			description:
				"Give somebody a different role. Roles are preset files; owner is not among the ones that can be handed out here.",
			descriptionKey: "operations.member_setRole.description",
			inputs: [{ name: "member", accepts: objectOf("team.member") }],
			parameters: {
				type: "object",
				properties: {
					preset: { type: "string", enum: [...GRANTABLE_ROLES] },
					tags: { type: "array", items: { type: "string" } },
				},
				required: ["preset"],
			},
			invoke: async ({ references, params }) => {
				const id = memberIdOf(references);
				const member = await staffClient.getStaff(id);
				if (!member?.email) throw new Error(tr("errors.noEmail"));
				// The same script on a known address is exactly a role change, so
				// the rule about which roles may be handed out lives in one place.
				await runTeamInvite({
					rawText: `${member.name} <${member.email}>`,
					preset: String(params.preset),
					...(Array.isArray(params.tags) ? { tags: params.tags } : {}),
				});
				const updated = await staffClient.getStaff(id);
				if (updated) memberChanged(updated);
				return updated;
			},
		},
		{
			id: "team.member.deactivate",
			operator: "execute",
			target: "team.member",
			label: "Switch off access",
			labelKey: "operations.member_deactivate.label",
			description:
				"Mark somebody as no longer working here and revoke their open invitation. A token already issued keeps working until it expires.",
			descriptionKey: "operations.member_deactivate.description",
			inputs: [{ name: "member", accepts: objectOf("team.member") }],
			invoke: async ({ references }) => {
				const id = memberIdOf(references);
				await staffClient.updateStaff(id, { active: false });
				const member = await staffClient.getStaff(id);
				// An open invitation outlives the card unless it is closed too,
				// and an address that is still invited is an address that can
				// still get in.
				if (member?.email) {
					try {
						const listed = await identityClient.listInvites({
							offset: 0,
							limit: 1,
							email: member.email,
						});
						const invite = listed.items?.[0];
						if (
							invite &&
							(invite.status === "pending" || invite.status === "sent")
						)
							await identityClient.revokeInvite(invite.id);
					} catch {
						// No right to touch invitations: the card is still switched off.
					}
				}
				if (member) memberChanged(member);
				return member;
			},
		},
		{
			id: "team.invite.revoke",
			operator: "execute",
			target: "team.invite",
			label: "Revoke invitation",
			labelKey: "operations.invite_revoke.label",
			description:
				"Shut an address out before it has been used. Immediate — the gate reads the invitation on every request.",
			descriptionKey: "operations.invite_revoke.description",
			inputs: [{ name: "invite", accepts: objectOf("team.invite") }],
			invoke: ({ references }) =>
				identityClient.revokeInvite(inviteIdOf(references)),
		},
		{
			id: "team.shift.create",
			operator: "create",
			target: "team.shift",
			label: "Schedule a shift",
			labelKey: "operations.shift_create.label",
			parameters: {
				type: "object",
				properties: {
					staffId: { type: "string" },
					startAt: { type: "string" },
					endAt: { type: "string" },
					note: { type: "string" },
				},
				required: ["staffId", "startAt", "endAt"],
			},
			invoke: ({ params }) =>
				staffClient.createShift({
					staffId: String(params.staffId),
					startAt: String(params.startAt),
					endAt: String(params.endAt),
					...(params.note ? { note: String(params.note) } : {}),
				}),
		},
	],
});
