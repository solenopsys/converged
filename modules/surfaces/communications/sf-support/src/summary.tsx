import { useUnit } from "effector-preact";
import {
	StatisticSummary,
	SummaryMetric,
	useSurfaceTranslation,
} from "front-core";
import { useEffect } from "preact/compat";
import { SURFACE_ID } from "./config";
import { $support, supportViewMounted } from "./domain-support";

// What Support shows while collapsed on the dashboard: what I am waiting on,
// and what the club as a whole is asking for.

export function SupportSummary() {
	const state = useUnit($support);
	const { t } = useSurfaceTranslation(SURFACE_ID);

	useEffect(() => {
		supportViewMounted();
	}, []);

	const openMine = state.mine.filter((ticket) => ticket.status === "open");
	const planned = state.features.filter(
		(ticket) => ticket.status === "planned",
	);

	return (
		<StatisticSummary>
			<SummaryMetric
				label={String(t("stats.mineOpenShort"))}
				value={openMine.length}
			/>
			<SummaryMetric
				label={String(t("stats.features"))}
				value={state.features.length}
			/>
			{/* Not a count of wishes — a count of wishes the team has taken. */}
			<SummaryMetric
				label={String(t("stats.planned"))}
				value={planned.length}
			/>
		</StatisticSummary>
	);
}
