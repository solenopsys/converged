import { useUnit } from "effector-preact";
import {
	HeaderPanelLayout,
	InfiniteScrollDataTable,
	Plus,
	RefreshCw,
} from "front-core";
import React, { useEffect } from "preact/compat";
import {
	$workflowsStore,
	addWorkflowClicked,
	openWorkflowForm,
	refreshWorkflowsClicked,
	workflowsViewMounted,
} from "../domain-workflows";
import { workflowsColumns } from "../functions/columns";
import { createWorkflowFormWidget } from "../functions/wokflow";

export const WorkflowsListView = ({ bus }) => {
	const workflowsState = useUnit($workflowsStore.$state);

	useEffect(() => {
		workflowsViewMounted();

		const unwatch = addWorkflowClicked.watch(() => {
			openWorkflowForm({ workflow: null });
			bus.present({ widget: createWorkflowFormWidget(bus) });
		});

		return () => unwatch();
	}, [bus]);

	const headerConfig = {
		title: "Workflows",
		actions: [
			{
				id: "add",
				label: "Add Workflow",
				icon: Plus,
				event: addWorkflowClicked,
				variant: "default" as const,
			},
			{
				id: "refresh",
				label: "Refresh",
				icon: RefreshCw,
				event: refreshWorkflowsClicked,
				variant: "outline" as const,
			},
		],
	};

	const handleRowClick = (row) => {
		openWorkflowForm({ workflow: row });
		bus.present({
			widget: createWorkflowFormWidget(bus),
			params: { entity: row },
			tab: { key: `dag.workflow:${row.id}`, title: row.name ?? row.id },
		});
	};

	return (
		<HeaderPanelLayout config={headerConfig}>
			<InfiniteScrollDataTable
				data={workflowsState.items}
				hasMore={workflowsState.hasMore}
				loading={workflowsState.loading}
				columns={workflowsColumns}
				onLoadMore={$workflowsStore.loadMore}
				onRowClick={handleRowClick}
				viewMode="table"
			/>
		</HeaderPanelLayout>
	);
};

export default WorkflowsListView;
