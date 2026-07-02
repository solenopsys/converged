import { EntityListView } from "front-core";
import React from "react";
import { $executionsStore } from "../domain-executions";
import { executionsColumns } from "../functions/columns";
import { createContextWidget, openContextDetail } from "../functions/context";

export const ExecutionsView = ({ bus }) => {
	const handleRowClick = (row: { id: string }) => {
		openContextDetail({ contextId: row.id });
		bus.present({ widget: createContextWidget(bus) });
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
