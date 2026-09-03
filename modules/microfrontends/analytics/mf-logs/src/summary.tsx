import { useUnit } from "effector-preact";
import { StatisticSummary, SummaryMetric } from "front-core";
import { useEffect } from "preact/compat";
import { $logsStats, logsTitleStatsViewMounted } from "./domain-stats";

// The Logs section's readout while it is collapsed. The statistic is a set of
// current totals with no daily series behind it, so there is nothing to plot.

export function LogsSummary() {
	const stats = useUnit($logsStats);

	useEffect(() => {
		logsTitleStatsViewMounted();
	}, []);

	return (
		<StatisticSummary>
			<SummaryMetric label="Hot" value={stats.totalHot ?? 0} />
			<SummaryMetric label="Cold" value={stats.totalCold ?? 0} />
			<SummaryMetric label="Errors" value={stats.errors ?? 0} />
			<SummaryMetric label="Warnings" value={stats.warnings ?? 0} />
		</StatisticSummary>
	);
}
