import { useUnit } from "effector-preact";
import { StatisticSummary, SummaryMetric } from "front-core";
import { useEffect } from "preact/compat";
import {
	$telemetryStats,
	telemetryTitleStatsViewMounted,
} from "./domain-stats";

// The Telemetry section's readout while it is collapsed.

export function TelemetrySummary() {
	const stats = useUnit($telemetryStats);

	useEffect(() => {
		telemetryTitleStatsViewMounted();
	}, []);

	return (
		<StatisticSummary>
			<SummaryMetric label="Hot" value={stats.totalHot ?? 0} />
			<SummaryMetric label="Cold" value={stats.totalCold ?? 0} />
			<SummaryMetric
				label="Devices"
				value={stats.devices ?? Object.keys(stats.byDevice ?? {}).length}
			/>
			<SummaryMetric
				label="Parameters"
				value={stats.parameters ?? Object.keys(stats.byParam ?? {}).length}
			/>
		</StatisticSummary>
	);
}
