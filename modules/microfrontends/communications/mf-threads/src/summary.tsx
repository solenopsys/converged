import { useUnit } from "effector-preact";
import { StatisticSummary, SummaryMetric } from "front-core";
import { useEffect } from "preact/compat";
import { $threadsStats, threadsStatsViewMounted } from "./domain-stats";

// The Threads section's readout while it is collapsed.

export function ThreadsSummary() {
	const stats = useUnit($threadsStats);

	useEffect(() => {
		threadsStatsViewMounted();
	}, []);

	return (
		<StatisticSummary>
			<SummaryMetric label="Threads" value={stats.total ?? 0} />
			<SummaryMetric label="Messages" value={stats.totalMessages ?? 0} />
			<SummaryMetric label="Chat" value={stats.byKind?.chat ?? 0} />
			<SummaryMetric label="Audio" value={stats.byKind?.audio ?? 0} />
			<SummaryMetric label="Forum" value={stats.byKind?.forum ?? 0} />
		</StatisticSummary>
	);
}
