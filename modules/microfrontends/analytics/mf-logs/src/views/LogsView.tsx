import { useUnit } from "effector-preact";
import { InfiniteScrollDataTable } from "front-core/table";
import { useEffect } from "preact/hooks";
import {
	$logsColdStore,
	$logsHotStore,
	logsScreenActivated,
	logsViewMounted,
	refreshLogsClicked,
	type LogsMode,
} from "../domain-logs";
import { logsColumns } from "../functions/columns";

export function LogsView({ mode }: { mode: LogsMode }) {
	const table = useUnit(mode === "hot" ? $logsHotStore.$state : $logsColdStore.$state);
	const store = mode === "hot" ? $logsHotStore : $logsColdStore;

	useEffect(() => {
		logsViewMounted(mode);
	}, [mode]);

	return (
		<div class="logs-workspace">
			<header class="logs-workspace-header">
				<div>
					<h1>{mode === "hot" ? "Hot logs" : "Cold logs"}</h1>
					<p>{table.totalCount} entries</p>
				</div>
				<div class="logs-workspace-actions">
					<button type="button" onClick={() => logsScreenActivated("hot")}>
						Hot
					</button>
					<button type="button" onClick={() => logsScreenActivated("cold")}>
						Cold
					</button>
					<button type="button" onClick={refreshLogsClicked}>
						Refresh
					</button>
				</div>
			</header>
			{table.error ? <p class="logs-workspace-error">{table.error}</p> : null}
			<InfiniteScrollDataTable
				tableId={`logs-${mode}`}
				columns={logsColumns}
				data={table.items}
				totalCount={table.totalCount}
				hasMore={table.hasMore}
				loading={table.loading}
				loadingMore={table.loadingMore}
				onLoadMore={() => store.loadMore()}
				emptyMessage="No log entries"
			/>
		</div>
	);
}
