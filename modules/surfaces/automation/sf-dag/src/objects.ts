import { EntityListView } from "front-core";
import type {
	InfinityDefinition,
	ObjectDefinition,
} from "front-core/object-runtime";
import {
	defineSurface,
	objectOf,
	objectRef,
	setOf,
} from "front-core/object-runtime";
import type { PaginationParams } from "g-dag";
import { $selectedContext, openContextDetail } from "./domain-contexts";
import {
	executionsColumns,
	tasksColumns,
	varsColumns,
	workflowsColumns,
} from "./functions/columns";
import dagService from "./service";
import { DagSummary } from "./summary";
import ContextViewer from "./views/ContextView";
import { StatsView } from "./views/StatsView";

const selectableTypes = [
	["dag.workflow", "Workflow", "Workflows"],
	["dag.execution", "Execution", "Executions"],
	["dag.task", "Task", "Tasks"],
	["dag.variable", "Variable", "Variables"],
] as const;

type DagEntityType = (typeof selectableTypes)[number][0];

const dagInfinity: Record<DagEntityType, InfinityDefinition> = {
	"dag.workflow": {
		tableId: "dag-workflows",
		title: "Workflows",
		columns: workflowsColumns,
		load: (params: Record<string, unknown>) =>
			dagService.listWorkflows(params as PaginationParams),
		rowRef: (row: Record<string, unknown>) =>
			objectRef("dag.workflow", String(row.id ?? row.name), {
				title: typeof row.name === "string" ? row.name : undefined,
			}),
		filters: [
			{ id: "name", label: "Workflow", type: "search", operator: "contains" },
			{ id: "script", label: "Script", type: "search", operator: "contains" },
		],
	},
	"dag.execution": {
		tableId: "dag-executions",
		title: "Executions",
		columns: executionsColumns,
		load: (params: Record<string, unknown>) =>
			dagService.listExecutions(params as PaginationParams),
		rowRef: (row: Record<string, unknown>) =>
			objectRef("dag.execution", String(row.id)),
		filters: [
			{
				id: "workflowName",
				label: "Workflow",
				type: "search",
				operator: "eq",
			},
			{
				id: "status",
				label: "Status",
				type: "select",
				operator: "eq",
				options: [
					{ value: "running", label: "Running" },
					{ value: "done", label: "Done" },
					{ value: "failed", label: "Failed" },
				],
			},
		],
	},
	"dag.task": {
		tableId: "dag-tasks",
		title: "Tasks",
		columns: tasksColumns,
		load: (params: Record<string, unknown>) =>
			dagService.listTasks(null, params as PaginationParams),
		rowRef: (row: Record<string, unknown>) =>
			objectRef("dag.task", String(row.id)),
		filters: [
			{ id: "executionId", label: "Execution", type: "search", operator: "eq" },
			{ id: "nodeId", label: "Node", type: "search", operator: "eq" },
			{
				id: "state",
				label: "State",
				type: "select",
				operator: "eq",
				options: [
					{ value: "queued", label: "Queued" },
					{ value: "processing", label: "Processing" },
					{ value: "done", label: "Done" },
					{ value: "failed", label: "Failed" },
				],
			},
		],
	},
	"dag.variable": {
		tableId: "dag-variables",
		title: "Variables",
		columns: varsColumns,
		load: (params: Record<string, unknown>) =>
			dagService.listVariables(params as PaginationParams),
		rowRef: (row: Record<string, unknown>) =>
			objectRef("dag.variable", String(row.key)),
		filters: [
			{ id: "key", label: "Key", type: "search", operator: "contains" },
		],
	},
};

const dagEntityTypes: ObjectDefinition[] = selectableTypes.map(
	([id, label, pluralLabel]) => ({
		id,
		label,
		pluralLabel,
		categories: ["core.automation", "core.selectable"],
		selection: {
			filters: [],
			describe: () => dagService.describeSelection(id),
			load: (params) => {
				switch (id) {
					case "dag.workflow":
						return dagService.listWorkflows(params);
					case "dag.execution":
						return dagService.listExecutions(params);
					case "dag.task":
						return dagService.listTasks(null, params);
					case "dag.variable":
						return dagService.listVariables(params);
				}
			},
			inspect: (filter) => dagService.inspectSelection(id, filter),
		},
		infinity: dagInfinity[id],
	}),
);

export default defineSurface({
	id: "sf-dag",
	label: "Workflows",
	purpose: "Background workflows, their runs, variables and failures",
	types: [
		...dagEntityTypes,
		{
			id: "dag.statistic.summary",
			label: "Workflows",
			categories: ["core.statistic"] as const,
			statistic: { role: "summary", component: DagSummary },
		},
		{
			id: "dag.statistic",
			label: "DAG statistic",
			pluralLabel: "DAG statistics",
			categories: ["core.statistic", "core.automation"] as const,
		},
	],
	views: [
		...selectableTypes.map(([id]) => ({
			id: `${id}.table`,
			accepts: setOf(id),
			component: EntityListView,
		})),
		{
			id: "dag.execution.detail",
			accepts: objectOf("dag.execution"),
			component: ContextViewer,
			props: (ref) => {
				const executionId = ref.kind === "object" ? ref.id : "";
				if (executionId) openContextDetail({ contextId: executionId });
				return { contextStore: $selectedContext };
			},
		},
		{
			id: "dag.statistic.dashboard",
			accepts: setOf("dag.statistic"),
			component: StatsView,
		},
	],
	operations: [
		{
			id: "dag.variable.save",
			operator: "save",
			target: "dag.variable",
			label: "Save variable",
			parameters: {
				type: "object",
				properties: { key: { type: "string" }, value: {} },
				required: ["key"],
			},
			invoke: ({ params }) =>
				dagService.setVar(String(params.key), params.value),
		},
	],
});
