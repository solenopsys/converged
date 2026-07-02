import { DashboardPieChartCard, type DashboardPinMeta } from "front-core";
import { useMemo } from "react";

export function CronStatusPieChart({
	active,
	paused,
	dashboardPin,
}: {
	active: number;
	paused: number;
	dashboardPin?: DashboardPinMeta;
}) {
	const data = useMemo(
		() => [
			{ key: "active", label: "Active", value: Number(active ?? 0) },
			{ key: "paused", label: "Paused", value: Number(paused ?? 0) },
		],
		[active, paused],
	);

	return (
		<DashboardPieChartCard
			title="Cron status"
			description="Active vs paused crons"
			data={data}
			dashboardPin={dashboardPin}
			colors={["#22c55e", "#6b7280"]}
			height={320}
		/>
	);
}
