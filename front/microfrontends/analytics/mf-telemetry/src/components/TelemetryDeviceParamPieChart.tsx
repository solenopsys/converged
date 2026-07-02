import { DashboardPieChartCard, type DashboardPinMeta } from "front-core";
import { useMemo } from "react";
import type { TelemetryEvent } from "../functions/types";

const COLORS = [
	"#3b82f6",
	"#22c55e",
	"#f59e0b",
	"#ef4444",
	"#06b6d4",
	"#f97316",
	"#84cc16",
	"#ec4899",
	"#14b8a6",
	"#a855f7",
];

export function TelemetryDeviceParamPieChart({
	data = [],
	dashboardPin,
}: {
	data: TelemetryEvent[];
	dashboardPin?: DashboardPinMeta;
}) {
	const chartData = useMemo(() => {
		const grouped = new Map<string, number>();
		for (const item of data) {
			const key = `${item.device_id || "unknown"} / ${item.param || "unknown"}`;
			grouped.set(key, (grouped.get(key) ?? 0) + 1);
		}
		return [...grouped.entries()].map(([key, value]) => ({
			key,
			label: key,
			value,
		}));
	}, [data]);

	return (
		<DashboardPieChartCard
			title="Device / param distribution"
			description="Hot telemetry events by source and metric"
			data={chartData}
			dashboardPin={dashboardPin}
			colors={COLORS}
			maxSlices={9}
			otherLabel="Other"
			isErrorLike={() => false}
		/>
	);
}
