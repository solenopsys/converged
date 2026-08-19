import { DashboardLineChartCard, type DashboardPinMeta } from "front-core";

type DailyRun = {
	date: string;
	total: number;
	success: number;
	failed: number;
};

export function CronRunsLineChart({
	data = [],
	dashboardPin,
}: {
	data: DailyRun[];
	dashboardPin?: DashboardPinMeta;
}) {
	return (
		<DashboardLineChartCard
			data={data}
			title="Daily runs"
			description="Scheduler runs by day"
			dashboardPin={dashboardPin}
			series={[
				{ key: "total", label: "Runs", color: "var(--ui-chart-1)", areaOpacity: 0.18 },
				{ key: "success", label: "Success", color: "var(--ui-success)", area: false },
				{ key: "failed", label: "Failed", color: "var(--ui-destructive)", area: false },
			]}
		/>
	);
}
