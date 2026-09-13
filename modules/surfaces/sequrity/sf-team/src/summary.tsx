import { useUnit } from "effector-preact";
import {
	StatisticSummary,
	SummaryMetric,
	useSurfaceTranslation,
} from "front-core";
import { useEffect } from "preact/compat";
import { SURFACE_ID } from "./config";
import { $team, teamViewMounted } from "./domain-team";

// What the Team section shows while it is collapsed on the dashboard: how many
// people work here, and how many of them are still only invited.

export function TeamSummary() {
	const team = useUnit($team);
	const { t } = useSurfaceTranslation(SURFACE_ID);

	useEffect(() => {
		teamViewMounted();
	}, []);

	const working = team.members.filter((member) => member.active);
	const waiting = team.invites.filter(
		(invite) => invite.status === "pending" || invite.status === "sent",
	);
	const undelivered = team.invites.filter(
		(invite) => invite.status === "pending",
	);

	return (
		<StatisticSummary>
			<SummaryMetric
				label={String(t("stats.working"))}
				value={working.length}
			/>
			<SummaryMetric
				label={String(t("stats.withConsole"))}
				value={working.filter((member) => member.userId).length}
			/>
			<SummaryMetric
				label={String(t("stats.invited"))}
				value={waiting.length}
			/>
			{/* Not a count of people — a count of letters that never left. */}
			<SummaryMetric
				label={String(t("stats.undelivered"))}
				value={undelivered.length}
			/>
		</StatisticSummary>
	);
}
