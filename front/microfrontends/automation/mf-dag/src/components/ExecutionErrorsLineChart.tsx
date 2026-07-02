import { DashboardLineChartCard, type DashboardPinMeta } from "front-core";
import { useMemo } from "react";

type DailyPoint = {
	date: string;
	total: number;
	failed: number;
};

export function ExecutionErrorsLineChart({
	data = [],
	nodesData = [],
	title,
	description,
	dashboardPin,
}: {
	data: DailyPoint[];
	nodesData?: DailyPoint[];
	title?: string;
	description?: string;
	dashboardPin?: DashboardPinMeta;
}) {
	const chartData = useMemo(() => {
		const wfMap = new Map(data.map((d) => [d.date, d]));
		const nodeMap = new Map(nodesData.map((d) => [d.date, d]));
		const allDates = Array.from(
			new Set([...wfMap.keys(), ...nodeMap.keys()]),
		).sort();
		return allDates.map((date) => {
			const wf = wfMap.get(date);
			const node = nodeMap.get(date);
			return {
				date,
				wfFailed: wf?.failed ?? 0,
				nodeFailed: node?.failed ?? 0,
				rate: wf?.total ? Number(((wf.failed / wf.total) * 100).toFixed(2)) : 0,
			};
		});
	}, [data, nodesData]);

	return (
		<DashboardLineChartCard
			data={chartData}
			title={title}
			description={description}
			dashboardPin={dashboardPin}
			secondaryAxis={{ primaryName: "Errors", name: "%", min: 0, max: 100 }}
			series={[
				{ key: "wfFailed", label: "WF errors", color: "#ef4444", type: "bar" },
				{ key: "nodeFailed", label: "Node errors", color: "#f97316", type: "bar" },
				{ key: "rate", label: "WF error rate %", color: "#facc15", yAxisIndex: 1 },
			]}
		/>
	);
}
