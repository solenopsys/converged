import { createDomain } from "effector";
import { createInfiniteTableStore, EntityListView } from "front-core";
import type { SetRef } from "front-core/object-runtime";
import { COLUMN_TYPES } from "front-core/table";
import type { PaginationParams } from "g-dag";
import { useMemo } from "preact/compat";
import dagService from "../service";

export type DagEntityType =
	| "dag.workflow"
	| "dag.execution"
	| "dag.task"
	| "dag.variable";

const config: Record<
	DagEntityType,
	{
		title: string;
		columns: Array<{
			id: string;
			title: string;
			type: string;
			primary?: boolean;
		}>;
	}
> = {
	"dag.workflow": {
		title: "Workflows",
		columns: [
			{ id: "name", title: "Workflow", type: COLUMN_TYPES.TEXT, primary: true },
			{ id: "script", title: "Script", type: COLUMN_TYPES.TEXT },
			{ id: "description", title: "Description", type: COLUMN_TYPES.TEXT },
		],
	},
	"dag.execution": {
		title: "Executions",
		columns: [
			{ id: "id", title: "Execution", type: COLUMN_TYPES.TEXT, primary: true },
			{ id: "workflowName", title: "Workflow", type: COLUMN_TYPES.TEXT },
			{ id: "status", title: "Status", type: COLUMN_TYPES.STATUS },
			{ id: "updatedAt", title: "Updated", type: COLUMN_TYPES.DATE },
		],
	},
	"dag.task": {
		title: "Tasks",
		columns: [
			{ id: "id", title: "Task", type: COLUMN_TYPES.NUMBER, primary: true },
			{ id: "executionId", title: "Execution", type: COLUMN_TYPES.TEXT },
			{ id: "nodeId", title: "Node", type: COLUMN_TYPES.TEXT },
			{ id: "state", title: "Status", type: COLUMN_TYPES.STATUS },
		],
	},
	"dag.variable": {
		title: "Variables",
		columns: [
			{ id: "key", title: "Key", type: COLUMN_TYPES.TEXT, primary: true },
			{ id: "value", title: "Value", type: COLUMN_TYPES.TEXT },
		],
	},
};

const load = (kind: DagEntityType, params: PaginationParams) => {
	switch (kind) {
		case "dag.workflow":
			return dagService.listWorkflows(params);
		case "dag.execution":
			return dagService.listExecutions(params);
		case "dag.task":
			return dagService.listTasks(null, params);
		case "dag.variable":
			return dagService.listVariables(params);
	}
};

export const DagEntityListView = ({
	kind,
	reference,
}: {
	kind: DagEntityType;
	reference?: SetRef;
}) => {
	const store = useMemo(() => {
		const domain = createDomain(`dag-${kind}-${crypto.randomUUID()}`);
		return createInfiniteTableStore(domain, (params) =>
			load(kind, params as PaginationParams),
		);
	}, [kind]);
	const filter =
		reference?.kind === "set" && reference.selection.kind === "query"
			? reference.selection.filter
			: undefined;
	return (
		<EntityListView
			tableId={kind}
			title={config[kind].title}
			store={store}
			columns={config[kind].columns}
			baseFilters={filter ? { filter } : undefined}
		/>
	);
};
