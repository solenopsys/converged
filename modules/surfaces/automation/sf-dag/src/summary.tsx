import { useUnit } from "effector-preact";
import { Sparkline, StatisticSummary, SummaryMetric } from "front-core";
import { useEffect, useMemo } from "preact/compat";
import { $dagStats, statsViewMounted } from "./domain-stats";

// The DAG section's readout while it is collapsed.

export function DagSummary() {
	const stats = useUnit($dagStats);

	useEffect(() => {
		statsViewMounted();
	}, []);

	const runsPerDay = useMemo(
		() => (stats.daily ?? []).map((point) => Number(point.total ?? 0)),
		[stats.daily],
	);
	const failedRate = useMemo(() => {
		const total = Number(stats.total ?? 0);
		return total ? Math.round((Number(stats.failed ?? 0) / total) * 100) : 0;
	}, [stats.total, stats.failed]);

	return (
		<StatisticSummary>
			<SummaryMetric label="Runs" value={stats.total ?? 0} />
			<SummaryMetric label="Running" value={stats.running ?? 0} />
			<SummaryMetric label="Done" value={stats.done ?? 0} />
			<SummaryMetric label="Failed" value={stats.failed ?? 0} />
			<SummaryMetric label="Failed rate" value={`${failedRate}%`} />
			<Sparkline values={runsPerDay} label="Runs per day" className="ml-auto" />
		</StatisticSummary>
	);
}
