import { useUnit } from "effector-preact";
import { StatisticSummary, SummaryMetric } from "front-core";
import type { EquipmentStatus } from "g-equipment";
import { useEffect } from "preact/compat";
import { $floor, equipmentViewMounted } from "./domain-equipment";

// What the Equipment section shows while it is collapsed on the dashboard:
// how much of the floor is working and how much of it needs someone.

function countOf(
	counts: ReadonlyArray<{ status: EquipmentStatus; count: number }>,
	status: EquipmentStatus,
): number {
	return counts.find((entry) => entry.status === status)?.count ?? 0;
}

export function EquipmentSummary() {
	const floor = useUnit($floor);

	useEffect(() => {
		equipmentViewMounted();
	}, []);

	const counts = floor.dashboard?.statusCounts ?? [];

	return (
		<StatisticSummary>
			<SummaryMetric label="Machines" value={floor.dashboard?.total ?? 0} />
			<SummaryMetric label="Running" value={countOf(counts, "running")} />
			<SummaryMetric label="Idle" value={countOf(counts, "idle")} />
			<SummaryMetric label="Service" value={countOf(counts, "maintenance")} />
			<SummaryMetric
				label="Down"
				value={countOf(counts, "error") + countOf(counts, "offline")}
			/>
			<SummaryMetric
				label="Utilization"
				value={`${Math.round(floor.dashboard?.utilizationPercent ?? 0)}%`}
			/>
		</StatisticSummary>
	);
}
