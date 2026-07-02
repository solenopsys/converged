import { DashboardLineChartCard, type DashboardPinMeta } from "front-core";

type DailyPoint = {
	date: string;
	total: number;
	running: number;
	done: number;
	failed: number;
};

export function ExecutionDailyLineChart({
	data = [],
	title,
	description,
	dashboardPin,
}: {
	data: DailyPoint[];
	title?: string;
	description?: string;
	dashboardPin?: DashboardPinMeta;
}) {
	return (
		<DashboardLineChartCard
			data={data}
			title={title}
			description={description}
			dashboardPin={dashboardPin}
			series={[
				{ key: "total", label: "Total", color: "#3b82f6", areaOpacity: 0.2 },
				{ key: "running", label: "Running", color: "#f59e0b", area: false },
				{ key: "done", label: "Done", color: "#22c55e", area: false },
				{ key: "failed", label: "Failed", color: "#ef4444", area: false },
			]}
		/>
	);
}
