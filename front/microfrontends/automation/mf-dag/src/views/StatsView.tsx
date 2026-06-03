import { useUnit } from "effector-react";
import {
	DashboardLayout,
	HeaderPanelLayout,
	ScrollArea,
	StatisticCard,
} from "front-core";
import {
	BarChart3,
	CheckCircle,
	Network,
	Percent,
	Play,
	RefreshCw,
	XCircle,
} from "lucide-react";
import { useEffect, useMemo } from "react";
import { ExecutionDailyLineChart } from "../components/ExecutionDailyLineChart";
import { ExecutionErrorsLineChart } from "../components/ExecutionErrorsLineChart";
import { ExecutionStatusPieChart } from "../components/ExecutionStatusPieChart";
import {
	$dagStats,
	refreshStatsClicked,
	statsViewMounted,
} from "../domain-stats";

const ICONS = {
	total: BarChart3,
	running: Play,
	done: CheckCircle,
	failed: XCircle,
	tasksTotal: Network,
	failedRate: Percent,
};

export const StatsView = ({ bus: _bus }: { bus?: unknown }) => {
	const stats = useUnit($dagStats);

	useEffect(() => {
		statsViewMounted();
	}, []);

	const headerConfig = {
		title: "DAG Statistics",
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

	const failedRate = useMemo(() => {
		const total = Number(stats.total ?? 0);
		const failed = Number(stats.failed ?? 0);
		if (!total) return 0;
		return Number(((failed / total) * 100).toFixed(2));
	}, [stats.total, stats.failed]);

	const statItems = [
		{
			key: "total",
			label: "WF Runs",
			icon: ICONS.total,
			value: Number(stats.total ?? 0),
		},
		{ key: "running", label: "Running", icon: ICONS.running },
		{ key: "done", label: "Done", icon: ICONS.done },
		{ key: "failed", label: "Failed", icon: ICONS.failed },
		{
			key: "tasksTotal",
			label: "Node executions",
			icon: ICONS.tasksTotal,
			value: Number(stats.tasksTotal ?? 0),
		},
		{
			key: "failedRate",
			label: "Failed rate %",
			icon: ICONS.failedRate,
			value: failedRate,
		},
	];

	const statusChartItems = useMemo(
		() => [
			{ key: "running", label: "Running", value: Number(stats.running ?? 0) },
			{ key: "done", label: "Done", value: Number(stats.done ?? 0) },
			{ key: "failed", label: "Failed", value: Number(stats.failed ?? 0) },
		],
		[stats.running, stats.done, stats.failed],
	);

	const typeChartItems = useMemo(
		() =>
			Object.entries(stats.types ?? {})
				.map(([key, value]) => ({
					key,
					label: key === "unknown" ? "Unknown workflow" : key,
					value: Number(value ?? 0),
				}))
				.filter((item) => item.value > 0),
		[stats.types],
	);

	const successErrorChartItems = useMemo(
		() => [
			{ key: "success", label: "Success", value: Number(stats.done ?? 0) },
			{ key: "error", label: "Error", value: Number(stats.failed ?? 0) },
		],
		[stats.done, stats.failed],
	);

	return (
		<HeaderPanelLayout config={headerConfig}>
			<ScrollArea className="h-full">
				<DashboardLayout>
					<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
						{statItems.map(({ key, label, icon: Icon, value }) => (
							<div key={key}>
								<StatisticCard
									title={label}
									value={value ?? stats[key] ?? 0}
									icon={Icon}
									description={
										key === "failedRate" ? "workflow failures" : "executions"
									}
									dashboardPin={{ id: `dag.stat.${key}`, title: label }}
								/>
							</div>
						))}
					</div>
					<div className="grid gap-4 xl:grid-cols-2">
						<div className="h-[280px]">
							<ExecutionDailyLineChart
								dashboardPin={{
									id: "dag.daily-execution-density",
									title: "Daily execution density",
									pinnedClassName: "min-h-[280px]",
								}}
								data={stats.daily}
								title="Daily execution density"
								description="Run activity by day and status"
							/>
						</div>
						<div className="h-[280px]">
							<ExecutionErrorsLineChart
								dashboardPin={{
									id: "dag.daily-errors",
									title: "Daily errors",
									pinnedClassName: "min-h-[280px]",
								}}
								data={stats.daily}
								nodesData={stats.nodesDaily}
								title="Daily errors"
								description="Errors count and error rate by day"
							/>
						</div>
					</div>
					<div className="grid gap-4 xl:grid-cols-3">
						<ExecutionStatusPieChart
							dashboardPin={{
								id: "dag.execution-status-distribution",
								title: "Execution status distribution",
								pinnedClassName: "min-h-[360px]",
							}}
							title="Execution status distribution"
							description="Current status split across runs"
							data={statusChartItems}
						/>
						<ExecutionStatusPieChart
							dashboardPin={{
								id: "dag.success-vs-error",
								title: "Success vs error",
								pinnedClassName: "min-h-[360px]",
							}}
							title="Success vs error"
							description="Completed and failed runs"
							data={successErrorChartItems}
						/>
						<ExecutionStatusPieChart
							dashboardPin={{
								id: "dag.execution-types-distribution",
								title: "Execution types distribution",
								pinnedClassName: "min-h-[360px]",
							}}
							title="Execution types distribution"
							description="Runs grouped by workflow"
							data={typeChartItems}
						/>
					</div>
				</DashboardLayout>
			</ScrollArea>
		</HeaderPanelLayout>
	);
};
