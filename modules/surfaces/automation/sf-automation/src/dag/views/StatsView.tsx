import { useUnit } from "effector-preact";
import {
	BarChart3,
	CheckCircle,
	DashboardLayout,
	HeaderPanelLayout,
	Percent,
	Play,
	RefreshCw,
	ScrollArea,
	StatisticCard,
	XCircle,
} from "front-core";
import { useEffect, useMemo } from "preact/compat";
import { ExecutionDailyLineChart } from "../components/ExecutionDailyLineChart";
import { ExecutionStatusPieChart } from "../components/ExecutionStatusPieChart";
import { ExecutionWorkflowBarChart } from "../components/ExecutionWorkflowBarChart";
import {
	$dagStats,
	refreshStatsClicked,
	statsViewMounted,
} from "../domain-stats";

export const StatsView = () => {
	const stats = useUnit($dagStats);

	useEffect(() => {
		statsViewMounted();
	}, []);

	const runs = stats.executions;

	const failedRate = useMemo(
		() =>
			runs.total ? Number(((runs.failed / runs.total) * 100).toFixed(2)) : 0,
		[runs.total, runs.failed],
	);

	const statItems = [
		{ key: "total", label: "Runs", icon: BarChart3, value: runs.total },
		{ key: "running", label: "Running", icon: Play, value: runs.running },
		{ key: "done", label: "Done", icon: CheckCircle, value: runs.done },
		{ key: "failed", label: "Failed", icon: XCircle, value: runs.failed },
		{
			key: "failedRate",
			label: "Failed rate %",
			icon: Percent,
			value: failedRate,
		},
	];

	const statusData = [
		{ key: "running", label: "Running", value: runs.running },
		{ key: "done", label: "Done", value: runs.done },
		{ key: "failed", label: "Failed", value: runs.failed },
	];

	const workflowData = useMemo(
		() =>
			Object.entries(stats.byWorkflow ?? {})
				.map(([workflow, total]) => ({ workflow, total }))
				.sort((a, b) => b.total - a.total)
				.slice(0, 10),
		[stats.byWorkflow],
	);

	return (
		<HeaderPanelLayout
			config={{
				title: "Workflow statistics",
				actions: [
					{
						id: "refresh",
						label: "Refresh",
						icon: RefreshCw,
						event: refreshStatsClicked,
						variant: "outline" as const,
					},
				],
			}}
		>
			<ScrollArea className="min-h-0 flex-1">
				<DashboardLayout>
					{statItems.map((item) => (
						<StatisticCard
							key={item.key}
							title={item.label}
							value={String(item.value)}
							icon={item.icon}
						/>
					))}
					<ExecutionDailyLineChart
						data={stats.daily ?? []}
						title="Runs per day"
						description="Last 30 days"
					/>
					<ExecutionStatusPieChart title="By status" data={statusData} />
					<ExecutionWorkflowBarChart
						title="By workflow"
						description="Busiest ten"
						data={workflowData}
					/>
				</DashboardLayout>
			</ScrollArea>
		</HeaderPanelLayout>
	);
};

export default StatsView;
