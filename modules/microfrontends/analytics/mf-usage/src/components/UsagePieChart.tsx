import { DashboardPieChartCard, type DashboardPinMeta } from "front-core";
import { useMemo } from "preact/compat";

interface UsageFunctionStatsItem {
	function: string;
	total: number;
}
interface UsagePieChartProps {
	data: UsageFunctionStatsItem[];
	title?: string;
	dashboardPin?: DashboardPinMeta;
}

export function UsagePieChart({ data = [], title, dashboardPin }: UsagePieChartProps) {
	const chartData = useMemo(
		() =>
			data.map((item) => ({
				key: item.function,
				label: item.function,
				value: item.total,
			})),
		[data],
	);

	return (
		<DashboardPieChartCard
			title={title}
			data={chartData}
			dashboardPin={dashboardPin}
		/>
	);
}
