import { useUnit } from "effector-preact";
import { StatisticSummary, SummaryMetric } from "front-core";
import { useEffect } from "preact/compat";
import { $telemetryStats, telemetryStatsViewMounted } from "./domain-stats";

// The Telemetry section's readout while it is collapsed.

export function TelemetrySummary() {
	const stats = useUnit($telemetryStats);

	useEffect(() => {
		telemetryStatsViewMounted();
	}, []);

	return (
		<StatisticSummary>
			<SummaryMetric label="Hot" value={stats.totalHot ?? 0} />
			<SummaryMetric label="Cold" value={stats.totalCold ?? 0} />
			<SummaryMetric
				label="Devices"
				value={Object.keys(stats.byDevice ?? {}).length}
			/>
			<SummaryMetric
				label="Parameters"
				value={Object.keys(stats.byParam ?? {}).length}
			/>
		</StatisticSummary>
	);
}
