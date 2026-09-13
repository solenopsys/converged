import { useUnit } from "effector-preact";
import { Clock, Mail, useSurfaceTranslation } from "front-core";
import type { Absence, Shift } from "g-staff";
import { useEffect } from "preact/compat";
import { ROLE_CLASSES, SURFACE_ID } from "../config";
import { $memberCard, memberOpened } from "../domain-team";

// One person, opened as a subtab inside the Team area: who they are, whether
// they can sign in and with what, and what they are scheduled for.
//
// The card deliberately does not offer a "grant" control. What somebody may do
// is a preset linked in `rp-access`, which refuses a browser outright — the
// role is changed through `team.member.setRole`, which runs the workflow. So
// this screen reports rights; it does not edit them.

type Translate = (key: string) => unknown;

const text = (t: Translate, key: string): string => String(t(key));

function formatRange(from: string, to: string): string {
	const start = new Date(from);
	const end = new Date(to);
	if (Number.isNaN(start.getTime())) return `${from} — ${to}`;
	const day = start.toLocaleDateString(undefined, {
		day: "2-digit",
		month: "2-digit",
	});
	const time = (value: Date) =>
		Number.isNaN(value.getTime())
			? "—"
			: value.toLocaleTimeString(undefined, {
					hour: "2-digit",
					minute: "2-digit",
				});
	return `${day} ${time(start)}–${time(end)}`;
}

function Field({ label, value }: { label: string; value: string }) {
	return (
		<div class="flex flex-col gap-0.5">
			<span class="text-[11px] uppercase tracking-wide text-muted-foreground">
				{label}
			</span>
			<span class="text-sm">{value}</span>
		</div>
	);
}

function ShiftRow({ shift, dash }: { shift: Shift; dash: string }) {
	return (
		<div class="flex items-center justify-between gap-3 border-b border-border py-1.5 text-xs last:border-b-0">
			<span class="font-mono text-muted-foreground">
				{formatRange(shift.startAt, shift.endAt)}
			</span>
			<span class="flex-1 truncate">{shift.note || shift.workId || dash}</span>
		</div>
	);
}

function AbsenceRow({ absence, dash }: { absence: Absence; dash: string }) {
	return (
		<div class="flex items-center justify-between gap-3 border-b border-border py-1.5 text-xs last:border-b-0">
			<span class="font-mono text-muted-foreground">
				{formatRange(absence.startAt, absence.endAt)}
			</span>
			<span class="flex-1 truncate">{absence.note || dash}</span>
		</div>
	);
}

export function MemberDetailView({ memberId }: { memberId?: string }) {
	const card = useUnit($memberCard);
	const { t } = useSurfaceTranslation(SURFACE_ID);
	const dash = text(t, "detail.empty");

	useEffect(() => {
		if (memberId) memberOpened({ memberId });
	}, [memberId]);

	const member = card.member;
	if (!member) {
		return (
			<div class="p-4 text-sm text-muted-foreground">
				{card.loading
					? text(t, "detail.loading")
					: (card.error ?? text(t, "detail.notFound"))}
			</div>
		);
	}

	const invite = card.invite;
	const roleName = invite?.preset ?? member.role;

	return (
		<div class="flex flex-col gap-4 p-4">
			<header class="flex items-start justify-between gap-3">
				<div class="flex flex-col gap-1">
					<h1 class="text-lg font-semibold">{member.name}</h1>
					<span class="text-sm text-muted-foreground">
						{member.email || member.contact || text(t, "detail.noAddress")}
					</span>
				</div>
				<span
					class={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${
						roleName ? (ROLE_CLASSES[roleName] ?? "") : ""
					}`}
				>
					{text(t, roleName ? `role.${roleName}` : "role.none")}
				</span>
			</header>

			<section class="grid grid-cols-2 gap-3 rounded-lg border border-border bg-card p-3 md:grid-cols-4">
				<Field
					label={text(t, "detail.status")}
					value={text(t, member.active ? "active.true" : "active.false")}
				/>
				<Field
					label={text(t, "detail.console")}
					value={text(
						t,
						member.userId ? "detail.canSignIn" : "detail.cardOnly",
					)}
				/>
				<Field label={text(t, "detail.language")} value={member.lang ?? dash} />
				<Field
					label={text(t, "detail.contact")}
					value={member.contact ?? dash}
				/>
			</section>

			{/* The rights half of the card. It is the intent of record — the role
			    and tags this person was given — and not a reading of their live
			    token, which nothing in a browser can obtain. */}
			<section class="flex flex-col gap-2">
				<h2 class="flex items-center gap-1.5 text-sm font-semibold">
					<Mail size={14} /> {text(t, "detail.access")}
				</h2>
				<div class="rounded-lg border border-border bg-card p-3 text-sm">
					{invite ? (
						<div class="flex flex-col gap-2">
							<div class="flex items-center gap-2">
								<span class="rounded px-1.5 py-0.5 text-[11px] font-medium">
									{text(t, `invite.${invite.status}`)}
								</span>
								<span class="text-xs text-muted-foreground">
									{text(t, "detail.invitedBy").replace(
										"{who}",
										invite.invitedBy,
									)}
								</span>
							</div>
							<Field
								label={text(t, "detail.groupTags")}
								value={invite.tags.length > 0 ? invite.tags.join(", ") : dash}
							/>
							<p class="text-xs text-muted-foreground">
								{text(t, "detail.rolesNote")}
							</p>
						</div>
					) : (
						<p class="text-sm text-muted-foreground">
							{text(t, "detail.noInvite")}
						</p>
					)}
				</div>
			</section>

			<section class="flex flex-col gap-2">
				<h2 class="flex items-center gap-1.5 text-sm font-semibold">
					<Clock size={14} /> {text(t, "detail.shifts")}
				</h2>
				{card.shifts.length === 0 ? (
					<p class="text-sm text-muted-foreground">
						{text(t, "detail.noShifts")}
					</p>
				) : (
					<div class="rounded-lg border border-border bg-card px-3 py-1">
						{card.shifts.map((shift) => (
							<ShiftRow key={shift.id} shift={shift} dash={dash} />
						))}
					</div>
				)}
			</section>

			<section class="flex flex-col gap-2">
				<h2 class="text-sm font-semibold">{text(t, "detail.away")}</h2>
				{card.absences.length === 0 ? (
					<p class="text-sm text-muted-foreground">
						{text(t, "detail.noAbsences")}
					</p>
				) : (
					<div class="rounded-lg border border-border bg-card px-3 py-1">
						{card.absences.map((absence) => (
							<AbsenceRow key={absence.id} absence={absence} dash={dash} />
						))}
					</div>
				)}
			</section>
		</div>
	);
}
