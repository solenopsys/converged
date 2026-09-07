import { useUnit } from "effector-preact";
import {
	BarChart3,
	CheckCircle,
	Percent,
	Play,
	registerDashboardWidgets,
	StatisticCard,
	XCircle,
} from "front-core";
import { useEffect, useMemo } from "preact/compat";
import { ExecutionDailyLineChart } from "../components/ExecutionDailyLineChart";
import { ExecutionStatusPieChart } from "../components/ExecutionStatusPieChart";
import { ExecutionWorkflowBarChart } from "../components/ExecutionWorkflowBarChart";
import { $dagStats, statsViewMounted } from "../domain-stats";

// Live dashboard widgets. Each renders the same component the statistics view
// does, bound to the shared $dagStats store, so a pinned indicator comes back
// as a live widget after a reload. Keys must match the `dashboardPin.id`s.

function useDagStatsLive() {
	const stats = useUnit($dagStats);
	useEffect(() => {
		statsViewMounted();
	}, []);
	return stats;
}

const STAT_META = {
	total: { label: "Runs", icon: BarChart3, description: "workflow runs" },
	running: { label: "Running", icon: Play, description: "workflow runs" },
	done: { label: "Done", icon: CheckCircle, description: "workflow runs" },
	failed: { label: "Failed", icon: XCircle, description: "workflow runs" },
	failedRate: {
		label: "Failed rate %",
		icon: Percent,
		description: "workflow failures",
	},
} as const;

type DagStatKey = keyof typeof STAT_META;

function DagStatIndicator({ statKey }: { statKey: DagStatKey }) {
	const stats = useDagStatsLive();
	const meta = STAT_META[statKey];
	const value = useMemo(() => {
		const runs = stats.executions;
		if (statKey === "failedRate")
			return runs.total
				? Number(((runs.failed / runs.total) * 100).toFixed(2))
				: 0;
		return runs[statKey];
	}, [stats, statKey]);

	return (
		<StatisticCard
			title={meta.label}
			value={value}
			icon={meta.icon}
			description={meta.description}
			dashboardPin={{ enabled: false }}
		/>
	);
}

function DagDailyDensityIndicator() {
	const stats = useDagStatsLive();
	return (
		<ExecutionDailyLineChart
			data={stats.daily}
			title="Daily run density"
			description="Run activity by day and status"
			dashboardPin={{ enabled: false }}
		/>
	);
}

function DagStatusDistributionIndicator() {
	const stats = useDagStatsLive();
	const data = useMemo(
		() => [
			{ key: "running", label: "Running", value: stats.executions.running },
			{ key: "done", label: "Done", value: stats.executions.done },
			{ key: "failed", label: "Failed", value: stats.executions.failed },
		],
		[stats],
	);
	return (
		<ExecutionStatusPieChart
			title="Run status distribution"
			description="Current status split across runs"
			data={data}
			dashboardPin={{ enabled: false }}
		/>
	);
}

function DagWorkflowDistributionIndicator() {
	const stats = useDagStatsLive();
	const data = useMemo(
		() =>
			Object.entries(stats.byWorkflow ?? {})
				.map(([workflow, total]) => ({ workflow, total: Number(total ?? 0) }))
				.filter((item) => item.total > 0)
				.sort((a, b) => b.total - a.total)
				.slice(0, 10),
		[stats],
	);
	return (
		<ExecutionWorkflowBarChart
			title="Runs by workflow"
			description="Busiest ten"
			data={data}
			dashboardPin={{ enabled: false }}
		/>
	);
}

registerDashboardWidgets({
	"dag.stat.total": () => <DagStatIndicator statKey="total" />,
	"dag.stat.running": () => <DagStatIndicator statKey="running" />,
	"dag.stat.done": () => <DagStatIndicator statKey="done" />,
	"dag.stat.failed": () => <DagStatIndicator statKey="failed" />,
	"dag.stat.failedRate": () => <DagStatIndicator statKey="failedRate" />,
	"dag.daily-execution-density": {
		render: () => <DagDailyDensityIndicator />,
		size: "lg",
	},
	"dag.execution-status-distribution": {
		render: () => <DagStatusDistributionIndicator />,
		size: "lg",
	},
	"dag.execution-types-distribution": {
		render: () => <DagWorkflowDistributionIndicator />,
		size: "lg",
	},
});
