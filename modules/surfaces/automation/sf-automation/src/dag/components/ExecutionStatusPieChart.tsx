import { DashboardPieChartCard, type DashboardPinMeta } from "front-core";

type Item = {
	key: string;
	label: string;
	value: number;
};

export function ExecutionStatusPieChart({
	title,
	description,
	data,
	dashboardPin,
}: {
	title: string;
	description?: string;
	data: Item[];
	dashboardPin?: DashboardPinMeta;
}) {
	return (
		<DashboardPieChartCard
			title={title}
			description={description}
			data={data}
			dashboardPin={dashboardPin}
		/>
	);
}
