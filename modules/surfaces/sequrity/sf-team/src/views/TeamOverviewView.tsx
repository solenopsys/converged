import { useUnit } from "effector-preact";
import {
	BadgeCheck,
	KeyRound,
	Mail,
	StatisticCard,
	Users,
	useSurfaceTranslation,
} from "front-core";
import { objectRef, presentReference } from "front-core/object-runtime";
import type { Invite } from "g-identity";
import type { StaffMember } from "g-staff";
import { useEffect, useMemo } from "preact/compat";
import { ROLE_CLASSES, SURFACE_ID } from "../config";
import { $team, teamViewMounted } from "../domain-team";

// The team at a glance: who works here, which of them can actually get into the
// console, and which letters never landed. This is the surface's own screen —
// the one shown when no subtab is pressed — so it answers "where does the team
// stand" and leaves "show me the list" to the projections beside it.

type Translate = (key: string) => unknown;

const text = (t: Translate, key: string): string => String(t(key));

function MemberTile({ member, t }: { member: StaffMember; t: Translate }) {
	const open = () =>
		void presentReference(
			objectRef("team.member", member.id, { title: member.name }),
		);

	return (
		<button
			type="button"
			onClick={open}
			class="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-accent"
		>
			<div class="flex items-start justify-between gap-2">
				<span class="truncate text-sm font-medium">{member.name}</span>
				<span
					class={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium ${
						member.role ? (ROLE_CLASSES[member.role] ?? "") : ""
					}`}
				>
					{text(t, member.role ? `role.${member.role}` : "role.none")}
				</span>
			</div>
			<div class="truncate text-xs text-muted-foreground">
				{member.email || member.contact || text(t, "detail.empty")}
			</div>
			{/* A card with no identity behind it is somebody who works here but
			    cannot sign in. Worth seeing at a glance, because it is the usual
			    reason a person "was added" and still cannot get in. */}
			<div class="text-xs text-muted-foreground">
				{text(t, member.userId ? "overview.hasConsole" : "overview.noConsole")}
			</div>
		</button>
	);
}

function InviteRow({ invite, t }: { invite: Invite; t: Translate }) {
	return (
		<div class="flex items-center justify-between gap-3 border-b border-border py-1.5 text-xs last:border-b-0">
			<span class="flex-1 truncate">{invite.email}</span>
			<span class="truncate text-muted-foreground">
				{text(t, invite.preset ? `role.${invite.preset}` : "role.none")}
			</span>
			<span class="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium">
				{text(t, `invite.${invite.status}`)}
			</span>
		</div>
	);
}

export function TeamOverviewView() {
	const team = useUnit($team);
	const { t } = useSurfaceTranslation(SURFACE_ID);

	useEffect(() => {
		teamViewMounted();
	}, []);

	const working = useMemo(
		() => team.members.filter((member) => member.active),
		[team.members],
	);
	const withConsole = useMemo(
		() => working.filter((member) => member.userId).length,
		[working],
	);
	const waiting = useMemo(
		() =>
			team.invites.filter(
				(invite) => invite.status === "pending" || invite.status === "sent",
			),
		[team.invites],
	);
	// The one number on this screen that means somebody has to do something: an
	// invitation that was never delivered is a person who is waiting for a
	// letter that does not exist.
	const undelivered = useMemo(
		() => waiting.filter((invite) => invite.status === "pending"),
		[waiting],
	);

	return (
		<div class="flex flex-col gap-4 p-4">
			<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
				<StatisticCard
					title={text(t, "stats.working")}
					actionKey="team.total"
					value={working.length}
					icon={Users}
					loading={team.loading}
				/>
				<StatisticCard
					title={text(t, "stats.withConsole")}
					actionKey="team.with-console"
					value={withConsole}
					description={text(t, "stats.cardOnly").replace(
						"{count}",
						String(working.length - withConsole),
					)}
					icon={BadgeCheck}
					loading={team.loading}
				/>
				<StatisticCard
					title={text(t, "stats.invited")}
					actionKey="team.invited"
					value={waiting.length}
					icon={Mail}
					loading={team.loading}
				/>
				<StatisticCard
					title={text(t, "stats.undelivered")}
					actionKey="team.undelivered"
					value={undelivered.length}
					icon={KeyRound}
					loading={team.loading}
				/>
			</div>

			{team.error ? (
				<div class="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
					{team.error}
				</div>
			) : null}

			<section class="flex flex-col gap-2">
				<h2 class="text-sm font-semibold">{text(t, "overview.team")}</h2>
				{working.length === 0 ? (
					<p class="text-sm text-muted-foreground">
						{text(t, team.loading ? "overview.loading" : "overview.empty")}
					</p>
				) : (
					<div class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
						{working.map((member) => (
							<MemberTile key={member.id} member={member} t={t} />
						))}
					</div>
				)}
			</section>

			<section class="flex flex-col gap-2">
				<h2 class="text-sm font-semibold">{text(t, "overview.waiting")}</h2>
				{waiting.length === 0 ? (
					<p class="text-sm text-muted-foreground">
						{text(t, "overview.noneWaiting")}
					</p>
				) : (
					<div class="rounded-lg border border-border bg-card px-3 py-1">
						{waiting.slice(0, 8).map((invite) => (
							<InviteRow key={invite.id} invite={invite} t={t} />
						))}
					</div>
				)}
			</section>
		</div>
	);
}
