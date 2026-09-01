import { createDomain } from "effector";
import { createInfiniteTableStore, EntityListView } from "front-core";
import type { SetRef } from "front-core/object-runtime";
import type { LogQueryParams } from "g-logs";
import { useMemo } from "preact/hooks";
import { logsColumns } from "../functions/columns";
import logs from "../service";

export type LogsMode = "hot" | "cold";

export function LogsView({
	mode,
	reference,
}: {
	mode: LogsMode;
	reference?: SetRef;
}) {
	const store = useMemo(() => {
		const domain = createDomain(`logs-${mode}-${crypto.randomUUID()}`);
		return createInfiniteTableStore(domain, (params) =>
			mode === "hot"
				? logs.listHot(params as LogQueryParams)
				: logs.listCold(params as LogQueryParams),
		);
	}, [mode]);
	const filter =
		reference?.kind === "set" && reference.selection.kind === "query"
			? reference.selection.filter
			: undefined;

	return (
		<EntityListView
			tableId={`logs-${mode}`}
			title={mode === "hot" ? "Hot logs" : "Cold logs"}
			store={store}
			columns={logsColumns}
			baseFilters={filter ? { filter } : undefined}
			emptyMessage="No log entries"
		/>
	);
}
