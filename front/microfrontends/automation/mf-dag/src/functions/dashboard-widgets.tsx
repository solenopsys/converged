import { useUnit } from "effector-react";
import { registerDashboardWidgets, StatisticCard } from "front-core";
import {
	BarChart3,
	CheckCircle,
	Network,
	Percent,
	Play,
	XCircle,
} from "lucide-react";
import { useEffect, useMemo } from "react";
import { ExecutionDailyLineChart } from "../components/ExecutionDailyLineChart";
import { ExecutionErrorsLineChart } from "../components/ExecutionErrorsLineChart";
import { ExecutionStatusPieChart } from "../components/ExecutionStatusPieChart";
import { $dagStats, statsViewMounted } from "../domain-stats";

// Live dashboard widgets for mf-dag. Each factory renders the same component as
// the DAG Statistics view, bound to the shared $dagStats store, so a pinned
// indicator re-materializes as a live widget after a reload. Keys must match
// the `dashboardPin.id`s used in StatsView.

function useDagStatsLive() {
	const stats = useUnit($dagStats);
	useEffect(() => {
		statsViewMounted();
	}, []);
	return stats;
}

const STAT_META = {
	total: { label: "WF Runs", icon: BarChart3, description: "executions" },
	running: { label: "Running", icon: Play, description: "executions" },
	done: { label: "Done", icon: CheckCircle, description: "executions" },
	failed: { label: "Failed", icon: XCircle, description: "executions" },
	tasksTotal: {
		label: "Node executions",
		icon: Network,
		description: "executions",
	},
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
		if (statKey === "failedRate") {
			const total = Number(stats.total ?? 0);
			const failed = Number(stats.failed ?? 0);
			return total ? Number(((failed / total) * 100).toFixed(2)) : 0;
		}
		return Number(stats[statKey] ?? 0);
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
			title="Daily execution density"
			description="Run activity by day and status"
			dashboardPin={{ enabled: false }}
		/>
	);
}

function DagDailyErrorsIndicator() {
	const stats = useDagStatsLive();
	return (
		<ExecutionErrorsLineChart
			data={stats.daily}
			nodesData={stats.nodesDaily}
			title="Daily errors"
			description="Errors count and error rate by day"
			dashboardPin={{ enabled: false }}
		/>
	);
}

function DagStatusDistributionIndicator() {
	const stats = useDagStatsLive();
	const data = useMemo(
		() => [
			{ key: "running", label: "Running", value: Number(stats.running ?? 0) },
			{ key: "done", label: "Done", value: Number(stats.done ?? 0) },
			{ key: "failed", label: "Failed", value: Number(stats.failed ?? 0) },
		],
		[stats],
	);
	return (
		<ExecutionStatusPieChart
			title="Execution status distribution"
			description="Current status split across runs"
			data={data}
			dashboardPin={{ enabled: false }}
		/>
	);
}

function DagSuccessVsErrorIndicator() {
	const stats = useDagStatsLive();
	const data = useMemo(
		() => [
			{ key: "success", label: "Success", value: Number(stats.done ?? 0) },
			{ key: "error", label: "Error", value: Number(stats.failed ?? 0) },
		],
		[stats],
	);
	return (
		<ExecutionStatusPieChart
			title="Success vs error"
			description="Completed and failed runs"
			data={data}
			dashboardPin={{ enabled: false }}
		/>
	);
}

function DagTypesDistributionIndicator() {
	const stats = useDagStatsLive();
	const data = useMemo(
		() =>
			Object.entries(stats.types ?? {})
				.map(([key, value]) => ({
					key,
					label: key === "unknown" ? "Unknown workflow" : key,
					value: Number(value ?? 0),
				}))
				.filter((item) => item.value > 0),
		[stats],
	);
	return (
		<ExecutionStatusPieChart
			title="Execution types distribution"
			description="Runs grouped by workflow"
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
	"dag.stat.tasksTotal": () => <DagStatIndicator statKey="tasksTotal" />,
	"dag.stat.failedRate": () => <DagStatIndicator statKey="failedRate" />,
	"dag.daily-execution-density": {
		render: () => <DagDailyDensityIndicator />,
		size: "lg",
	},
	"dag.daily-errors": { render: () => <DagDailyErrorsIndicator />, size: "lg" },
	"dag.execution-status-distribution": {
		render: () => <DagStatusDistributionIndicator />,
		size: "lg",
	},
	"dag.success-vs-error": {
		render: () => <DagSuccessVsErrorIndicator />,
		size: "lg",
	},
	"dag.execution-types-distribution": {
		render: () => <DagTypesDistributionIndicator />,
		size: "lg",
	},
});
