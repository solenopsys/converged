import { DashboardPieChartCard, type DashboardPinMeta } from "front-core";
import { useMemo } from "preact/compat";

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
			colors={["var(--ui-success)", "var(--ui-muted-foreground)"]}
			height={320}
		/>
	);
}
