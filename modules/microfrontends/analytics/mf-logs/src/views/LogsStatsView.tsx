import { useUnit } from "effector-preact";
import { useEffect } from "preact/hooks";
import {
	$logsStats,
	logsStatsViewMounted,
	refreshLogsStatsClicked,
} from "../domain-stats";

export function LogsStatsView() {
	const stats = useUnit($logsStats);

	useEffect(() => {
		logsStatsViewMounted();
	}, []);

	return (
		<div class="logs-workspace">
			<header class="logs-workspace-header">
				<div>
					<h1>Log statistics</h1>
					<p>Current storage totals and severity counts</p>
				</div>
				<button type="button" onClick={refreshLogsStatsClicked}>
					Refresh
				</button>
			</header>
			<div class="logs-stats-grid">
				<LogStat label="Hot" value={stats.totalHot} />
				<LogStat label="Cold" value={stats.totalCold} />
				<LogStat label="Errors" value={stats.errors} />
				<LogStat label="Warnings" value={stats.warnings} />
			</div>
		</div>
	);
}

function LogStat({ label, value }: { label: string; value: number }) {
	return (
		<div class="logs-stat">
			<span>{label}</span>
			<strong>{value.toLocaleString()}</strong>
		</div>
	);
}
