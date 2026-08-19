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
				{ key: "total", label: "Total", color: "var(--ui-chart-1)", areaOpacity: 0.2 },
				// Три остальных ряда — состояния, а не просто ряды: они носят
				// статусные цвета и всегда идут с подписью в легенде.
				{ key: "running", label: "Running", color: "var(--ui-warning)", area: false },
				{ key: "done", label: "Done", color: "var(--ui-success)", area: false },
				{ key: "failed", label: "Failed", color: "var(--ui-destructive)", area: false },
			]}
		/>
	);
}
