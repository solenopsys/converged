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

	const runs = stats.executions;

	const runsPerDay = useMemo(
		() => (stats.daily ?? []).map((point) => Number(point.total ?? 0)),
		[stats.daily],
	);
	const failedRate = useMemo(
		() => (runs.total ? Math.round((runs.failed / runs.total) * 100) : 0),
		[runs.total, runs.failed],
	);

	return (
		<StatisticSummary>
			<SummaryMetric label="Runs" value={runs.total} />
			<SummaryMetric label="Running" value={runs.running} />
			<SummaryMetric label="Done" value={runs.done} />
			<SummaryMetric label="Failed" value={runs.failed} />
			<SummaryMetric label="Failed rate" value={`${failedRate}%`} />
			<Sparkline values={runsPerDay} label="Runs per day" className="ml-auto" />
		</StatisticSummary>
	);
}
