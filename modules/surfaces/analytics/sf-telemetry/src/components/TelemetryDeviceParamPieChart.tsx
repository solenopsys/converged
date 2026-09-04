import { DashboardPieChartCard, type DashboardPinMeta } from "front-core";
import { useMemo } from "preact/compat";
import type { TelemetryEvent } from "../functions/types";

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
			otherLabel="Other"
			isErrorLike={() => false}
		/>
	);
}
