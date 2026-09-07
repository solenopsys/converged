import { DashboardLineChartCard, type DashboardPinMeta } from "front-core";
import type { DagStatsPoint } from "g-dag";

export function ExecutionDailyLineChart({
	data = [],
	title,
	description,
	dashboardPin,
}: {
	data: DagStatsPoint[];
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
				{
					key: "total",
					label: "Total",
					color: "var(--ui-chart-1)",
					areaOpacity: 0.2,
				},
				{ key: "done", label: "Done", color: "var(--ui-success)", area: false },
				{
					key: "failed",
					label: "Failed",
					color: "var(--ui-destructive)",
					area: false,
				},
			]}
		/>
	);
}
