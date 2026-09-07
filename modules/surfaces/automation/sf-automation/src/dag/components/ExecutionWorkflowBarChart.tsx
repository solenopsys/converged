import { DashboardPieChartCard, type DashboardPinMeta } from "front-core";

/** Which workflows account for the runs. A pie reads better than a bar here:
 *  the question is share of total, not absolute count per name. */
export function ExecutionWorkflowBarChart({
	title,
	description,
	data,
	dashboardPin,
}: {
	title: string;
	description?: string;
	data: { workflow: string; total: number }[];
	dashboardPin?: DashboardPinMeta;
}) {
	return (
		<DashboardPieChartCard
			title={title}
			description={description}
			dashboardPin={dashboardPin}
			data={data.map((item) => ({
				key: item.workflow,
				label: item.workflow,
				value: item.total,
			}))}
		/>
	);
}
