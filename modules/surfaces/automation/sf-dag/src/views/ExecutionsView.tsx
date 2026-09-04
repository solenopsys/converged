import { EntityListView } from "front-core";
import React from "preact/compat";
import { $executionsStore } from "../domain-executions";
import { executionsColumns } from "../functions/columns";
import { createContextWidget, openContextDetail } from "../functions/context";

export const ExecutionsView = ({ bus }) => {
	const handleRowClick = (row: { id: string }) => {
		openContextDetail({ contextId: row.id });
		bus.present({
			widget: createContextWidget(bus),
			params: { contextId: row.id, entity: row },
			tab: { key: `dag.execution:${row.id}`, title: `Execution ${row.id}` },
		});
	};

	return (
		<EntityListView
			tableId="dag-executions"
			title="Executions"
			store={$executionsStore}
			columns={executionsColumns}
			onRowClick={handleRowClick}
		/>
	);
};
