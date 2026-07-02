import { DashboardPieChartCard, type DashboardPinMeta } from "front-core";
import { useMemo } from "react";

interface UsageFunctionStatsItem {
	function: string;
	total: number;
}
interface UsagePieChartProps {
	data: UsageFunctionStatsItem[];
	title?: string;
	dashboardPin?: DashboardPinMeta;
}

const COLORS = [
	"#3b82f6",
	"#22c55e",
	"#f59e0b",
	"#ef4444",
	"#8b5cf6",
	"#06b6d4",
	"#f97316",
];

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
			colors={COLORS}
		/>
	);
}
