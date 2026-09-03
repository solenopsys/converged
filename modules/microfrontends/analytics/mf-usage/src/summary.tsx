import { useUnit } from "effector-preact";
import { Sparkline, StatisticSummary, SummaryMetric } from "front-core";
import { useEffect, useMemo } from "preact/compat";
import {
	$dailyStats,
	$functionStats,
	$totalStats,
	usageStatsViewMounted,
} from "./domain-stats";

// The Usage section's readout while it is collapsed.

export function UsageSummary() {
	const total = useUnit($totalStats);
	const daily = useUnit($dailyStats);
	const functions = useUnit($functionStats);

	useEffect(() => {
		usageStatsViewMounted();
	}, []);

	const callsPerDay = useMemo(
		() => daily.map((point) => Number(point.total ?? 0)),
		[daily],
	);

	return (
		<StatisticSummary>
			<SummaryMetric label="Calls" value={total ?? 0} />
			<SummaryMetric label="Functions" value={functions.length} />
			<Sparkline
				values={callsPerDay}
				label="Calls per day"
				className="ml-auto"
			/>
		</StatisticSummary>
	);
}
