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
				{ key: "total", label: "Runs", color: "#3b82f6", areaOpacity: 0.18 },
				{ key: "success", label: "Success", color: "#22c55e", area: false },
				{ key: "failed", label: "Failed", color: "#ef4444", area: false },
			]}
		/>
	);
}
