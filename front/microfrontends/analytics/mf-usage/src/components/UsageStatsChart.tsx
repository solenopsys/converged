import { DashboardLineChartCard, type DashboardPinMeta } from "front-core";

interface UsageDailyStatsItem {
	date: string;
	total: number;
}
interface UsageStatsChartProps {
	data: UsageDailyStatsItem[];
	title?: string;
	description?: string;
	dashboardPin?: DashboardPinMeta;
}

export function UsageStatsChart({
	data = [],
	title,
	description,
	dashboardPin,
}: UsageStatsChartProps) {
	return (
		<DashboardLineChartCard
			data={data}
			title={title}
			description={description}
			dashboardPin={dashboardPin}
			series={[{ key: "total", label: "Usage", color: "#3b82f6" }]}
		/>
	);
}
