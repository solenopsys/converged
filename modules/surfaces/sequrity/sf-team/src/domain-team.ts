import { createDomain, sample } from "effector";
import type { Invite } from "g-identity";
import type { Absence, Shift, StaffMember } from "g-staff";
import { identityClient, staffClient } from "./services";

const domain = createDomain("sf-team");

export const teamViewMounted = domain.createEvent("TEAM_VIEW_MOUNTED");
export const refreshClicked = domain.createEvent("TEAM_REFRESH_CLICKED");
export const memberOpened = domain.createEvent<{ memberId: string }>(
	"TEAM_MEMBER_OPENED",
);
export const memberChanged = domain.createEvent<StaffMember>(
	"TEAM_MEMBER_CHANGED",
);
/** The import finished; the roster on screen is a run behind. */
export const teamImported = domain.createEvent<{ staffIds: string[] }>(
	"TEAM_IMPORTED",
);

// ---- the team overview ------------------------------------------------------

/**
 * Two reads, not one.
 *
 * The roster and the invitations live in different services and neither may ask
 * the other — that is the platform invariant, not a shortcut. The join is this
 * view's job, which is exactly the composition the UI is allowed to do.
 *
 * The invitations read is allowed to fail on its own: an operator holds
 * `rp/staff` but not `rp/identity/listInvites`, so for them the screen is a
 * roster without a delivery column rather than an error page.
 */
export const loadTeamFx = domain.createEffect({
	name: "LOAD_TEAM",
	handler: async (): Promise<{ members: StaffMember[]; invites: Invite[] }> => {
		const roster = await staffClient.listStaff({ offset: 0, limit: 500 });
		let invites: Invite[] = [];
		try {
			const listed = await identityClient.listInvites({
				offset: 0,
				limit: 500,
			});
			invites = listed.items ?? [];
		} catch {
			invites = [];
		}
		return { members: roster.items ?? [], invites };
	},
});

export type TeamState = {
	members: StaffMember[];
	invites: Invite[];
	loading: boolean;
	error?: string;
};

export const $team = domain
	.createStore<TeamState>(
		{ members: [], invites: [], loading: false },
		{ name: "TEAM" },
	)
	.on(loadTeamFx, (state) => ({ ...state, loading: true, error: undefined }))
	.on(loadTeamFx.doneData, (state, data) => ({
		...state,
		...data,
		loading: false,
	}))
	.on(loadTeamFx.failData, (state, error) => ({
		...state,
		loading: false,
		error: String(error?.message ?? error),
	}))
	.on(memberChanged, (state, member) => ({
		...state,
		members: state.members.map((item) =>
			item.id === member.id ? member : item,
		),
	}));

sample({
	clock: [teamViewMounted, refreshClicked, teamImported],
	target: loadTeamFx,
});

// ---- one person -------------------------------------------------------------

export type MemberCard = {
	member?: StaffMember;
	invite?: Invite;
	shifts: Shift[];
	absences: Absence[];
	loading: boolean;
	error?: string;
};

/**
 * The card of one person: who they are, whether they can sign in, and what they
 * are scheduled for. The invitation is read by address, because that — not the
 * user id — is what the two services have in common.
 */
export const loadMemberFx = domain.createEffect({
	name: "LOAD_TEAM_MEMBER",
	handler: async (memberId: string): Promise<Omit<MemberCard, "loading">> => {
		const member = await staffClient.getStaff(memberId);
		const [shifts, absences] = await Promise.all([
			staffClient.listShifts({ offset: 0, limit: 50, staffId: memberId }),
			staffClient.listAbsences({ offset: 0, limit: 50, staffId: memberId }),
		]);

		let invite: Invite | undefined;
		if (member?.email) {
			try {
				const listed = await identityClient.listInvites({
					offset: 0,
					limit: 1,
					email: member.email,
				});
				invite = listed.items?.[0];
			} catch {
				invite = undefined;
			}
		}

		return {
			member: member ?? undefined,
			invite,
			shifts: shifts.items ?? [],
			absences: absences.items ?? [],
		};
	},
});

export const $memberCard = domain
	.createStore<MemberCard>(
		{ shifts: [], absences: [], loading: false },
		{ name: "TEAM_MEMBER_CARD" },
	)
	.on(loadMemberFx, (state) => ({ ...state, loading: true, error: undefined }))
	.on(loadMemberFx.doneData, (state, data) => ({
		...state,
		...data,
		loading: false,
	}))
	.on(loadMemberFx.failData, (state, error) => ({
		...state,
		loading: false,
		error: String(error?.message ?? error),
	}));

sample({
	clock: memberOpened,
	fn: ({ memberId }) => memberId,
	target: loadMemberFx,
});

// ---- the rights projection --------------------------------------------------

export type AccessRow = {
	id: string;
	name: string;
	email: string;
	preset: string;
	tags: string;
	state: "active" | "invited" | "none";
};

/**
 * What each person was given, joined from the two halves the console can see.
 *
 * It is the intent of record rather than a reading of anyone's live token:
 * `rp-access` is internal, so nothing here can ask what a JWT actually carries.
 * A revoked tag also keeps working until the token it rides is reissued, which
 * is why "Console" says where a person stands and not what they can do.
 */
export function accessRows(state: TeamState): AccessRow[] {
	const invitesByEmail = new Map(
		state.invites.map((invite) => [invite.email.toLowerCase(), invite]),
	);

	return state.members.map((member) => {
		const invite = member.email
			? invitesByEmail.get(member.email.toLowerCase())
			: undefined;
		const state_: AccessRow["state"] = !member.active
			? "none"
			: member.userId
				? "active"
				: invite && (invite.status === "pending" || invite.status === "sent")
					? "invited"
					: "none";

		return {
			id: member.id,
			name: member.name,
			email: member.email ?? "",
			preset: invite?.preset ?? member.role ?? "",
			tags: (invite?.tags ?? []).join(", "),
			state: state_,
		};
	});
}
