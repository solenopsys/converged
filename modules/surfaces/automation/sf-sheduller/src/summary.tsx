import { useUnit } from "effector-preact";
import { Sparkline, StatisticSummary, SummaryMetric } from "front-core";
import { useEffect, useMemo } from "preact/compat";
import { $stats, statsViewMounted } from "./domain-stats";

// The Scheduler section's readout while it is collapsed.

export function ShedullerSummary() {
	const stats = useUnit($stats);

	useEffect(() => {
		statsViewMounted();
	}, []);

	const runsPerDay = useMemo(
		() => (stats.dailyRuns ?? []).map((point) => Number(point.total ?? 0)),
		[stats.dailyRuns],
	);
	const failed = useMemo(
		() =>
			(stats.dailyRuns ?? []).reduce(
				(total, point) => total + Number(point.failed ?? 0),
				0,
			),
		[stats.dailyRuns],
	);

	return (
		<StatisticSummary>
			<SummaryMetric label="Crons" value={stats.crons ?? 0} />
			<SummaryMetric label="Active" value={stats.activeCrons ?? 0} />
			<SummaryMetric label="Paused" value={stats.pausedCrons ?? 0} />
			<SummaryMetric label="Failed runs" value={failed} />
			<Sparkline values={runsPerDay} label="Runs per day" className="ml-auto" />
		</StatisticSummary>
	);
}
