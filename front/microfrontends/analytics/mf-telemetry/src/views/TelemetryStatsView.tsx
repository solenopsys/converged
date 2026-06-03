import { useUnit } from "effector-react";
import { HeaderPanelLayout, ScrollArea, StatisticCard } from "front-core";
import { Database, RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { TelemetryDeviceParamPieChart } from "../components/TelemetryDeviceParamPieChart";
import { TelemetryScatterChart } from "../components/TelemetryScatterChart";
import {
	$telemetryHotChartEvents,
	$telemetryStats,
	refreshTelemetryStatsClicked,
	telemetryStatsViewMounted,
} from "../domain-stats";

export const TelemetryStatsView = ({ bus: _bus }: { bus: unknown }) => {
	const stats = useUnit($telemetryStats);
	const hotChartEvents = useUnit($telemetryHotChartEvents);

	useEffect(() => {
		telemetryStatsViewMounted();
	}, []);

	const headerConfig = {
		title: "Telemetry Statistics",
		actions: [
			{
				id: "refresh",
				label: "Refresh",
				icon: RefreshCw,
				event: refreshTelemetryStatsClicked,
				variant: "outline" as const,
			},
		],
	};

	return (
		<HeaderPanelLayout config={headerConfig}>
			<ScrollArea className="h-full">
				<div className="space-y-4">
					<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
						<StatisticCard
							title="Hot Storage"
							value={stats.totalHot}
							icon={Database}
							description="Events in operational storage"
							dashboardPin={{
								id: "telemetry.hot-storage",
								title: "Hot Storage",
							}}
						/>
						<StatisticCard
							title="Cold Storage"
							value={stats.totalCold}
							icon={Database}
							description="Events in long-term storage"
							dashboardPin={{
								id: "telemetry.cold-storage",
								title: "Cold Storage",
							}}
						/>
					</div>
					<div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)]">
						<TelemetryScatterChart
							dashboardPin={{
								id: "telemetry.hot-scatter",
								title: "Hot telemetry scatter",
								pinnedClassName: "min-h-[360px]",
							}}
							data={hotChartEvents}
						/>
						<TelemetryDeviceParamPieChart
							dashboardPin={{
								id: "telemetry.device-param-distribution",
								title: "Device / param distribution",
								pinnedClassName: "min-h-[360px]",
							}}
							data={hotChartEvents}
						/>
					</div>
				</div>
			</ScrollArea>
		</HeaderPanelLayout>
	);
};
