import { useUnit } from "effector-react";
import {
	DashboardLayout,
	HeaderPanelLayout,
	ScrollArea,
	StatisticCard,
} from "front-core";
import { Activity, Clock, History, RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { CronRunsLineChart } from "../components/CronRunsLineChart";
import { CronStatusPieChart } from "../components/CronStatusPieChart";
import { $stats, refreshStatsClicked, statsViewMounted } from "../domain-stats";

export const StatsView = () => {
	const stats = useUnit($stats);

	useEffect(() => {
		statsViewMounted();
	}, []);

	const headerConfig = {
		title: "Sheduller",
		actions: [
			{
				id: "refresh",
				label: "Refresh",
				icon: RefreshCw,
				event: refreshStatsClicked,
				variant: "outline" as const,
			},
		],
	};

	return (
		<HeaderPanelLayout config={headerConfig}>
			<ScrollArea className="h-full">
				<DashboardLayout>
					<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
						<StatisticCard
							title="Crons"
							value={stats.crons}
							icon={Clock}
							description="Scheduled tasks"
							dashboardPin={{ id: "sheduller.crons-count", title: "Crons" }}
						/>
						<StatisticCard
							title="Active crons"
							value={stats.activeCrons}
							icon={Activity}
							description="Enabled"
							dashboardPin={{
								id: "sheduller.active-crons-count",
								title: "Active crons",
							}}
						/>
						<StatisticCard
							title="History"
							value={stats.history}
							icon={History}
							description="Fired events"
							dashboardPin={{ id: "sheduller.history-count", title: "History" }}
						/>
						<StatisticCard
							title="Active rate %"
							value={
								stats.crons
									? Number(
											(
												(Number(stats.activeCrons ?? 0) /
													Number(stats.crons ?? 0)) *
												100
											).toFixed(2),
										)
									: 0
							}
							icon={Clock}
							description="Share of active crons"
							dashboardPin={{
								id: "sheduller.active-rate",
								title: "Active rate %",
							}}
						/>
					</div>
					<div className="grid gap-4 xl:grid-cols-2">
						<div className="h-[280px]">
							<CronRunsLineChart
								dashboardPin={{
									id: "sheduller.daily-runs",
									title: "Scheduler daily runs",
									pinnedClassName: "min-h-[280px]",
								}}
								data={stats.dailyRuns ?? []}
							/>
						</div>
						<CronStatusPieChart
							active={Number(stats.activeCrons ?? 0)}
							dashboardPin={{
								id: "sheduller.cron-status",
								title: "Scheduler cron status",
								pinnedClassName: "min-h-[320px]",
							}}
							paused={Number(stats.pausedCrons ?? 0)}
						/>
					</div>
				</DashboardLayout>
			</ScrollArea>
		</HeaderPanelLayout>
	);
};

export default StatsView;
