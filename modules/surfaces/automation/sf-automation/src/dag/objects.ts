import { EntityListView } from "front-core";
import type {
	InfinityDefinition,
	ObjectDefinition,
	SurfaceDefinition,
} from "front-core/object-runtime";
import { objectOf, objectRef, setOf } from "front-core/object-runtime";
import { COLUMN_TYPES } from "front-core/table";
import type { PaginationParams } from "g-dag";
import { $selectedContext, openContextDetail } from "./domain-contexts";
import { $nodesStore } from "./domain-nodes";
import { $providersStore } from "./domain-providers";
import { $scriptsStore, openScriptClicked } from "./domain-scripts";
import { loadVarDetail } from "./domain-vars";
import { openWorkflowForm } from "./domain-workflows";
import {
	executionsColumns,
	nodesColumns,
	providersColumns,
	tasksColumns,
	varsColumns,
	workflowsColumns,
} from "./functions/columns";
import dagService from "./service";
import { DagSummary } from "./summary";
import ContextViewer from "./views/ContextView";
import { NodeConfigForm } from "./views/NodeConfigForm";
import { ProviderConfigForm } from "./views/ProviderConfigForm";
import { ScriptDetailView } from "./views/ScriptDetailView";
import { StatsView } from "./views/StatsView";
import { VarDetailView } from "./views/VarDetailView";
import { WorkflowDetailView } from "./views/WorkflowDetailView";

const scriptColumns = [
	{ id: "path", title: "Path", type: COLUMN_TYPES.TEXT, primary: true },
	{ id: "hash", title: "Hash", type: COLUMN_TYPES.TEXT },
];

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

const dagConfigurationTypes: ObjectDefinition[] = [
	{
		id: "dag.node",
		label: "Node",
		pluralLabel: "Nodes",
		categories: ["core.automation", "core.selectable"],
		infinity: {
			tableId: "dag-nodes",
			title: "Nodes",
			columns: nodesColumns,
			store: $nodesStore,
			filters: [
				{ id: "name", label: "Name", type: "search", operator: "contains" },
			],
			rowRef: (row) =>
				objectRef("dag.node", String(row.name ?? row.id), {
					title: typeof row.name === "string" ? row.name : undefined,
				}),
		},
	},
	{
		id: "dag.provider",
		label: "Provider",
		pluralLabel: "Providers",
		categories: ["core.automation", "core.selectable"],
		infinity: {
			tableId: "dag-providers",
			title: "Providers",
			columns: providersColumns,
			store: $providersStore,
			filters: [
				{ id: "name", label: "Name", type: "search", operator: "contains" },
			],
			rowRef: (row) =>
				objectRef("dag.provider", String(row.name ?? row.id), {
					title: typeof row.name === "string" ? row.name : undefined,
				}),
		},
	},
	{
		id: "dag.script",
		label: "Script",
		pluralLabel: "Scripts",
		categories: ["core.automation", "core.selectable"],
		infinity: {
			tableId: "dag-scripts",
			title: "Scripts",
			columns: scriptColumns,
			store: $scriptsStore,
			rowRef: (row) =>
				objectRef("dag.script", String(row.path), {
					title: typeof row.path === "string" ? row.path : undefined,
				}),
			filters: [
				{ id: "path", label: "Path", type: "search", operator: "contains" },
			],
		},
	},
];

export const dagContribution: Pick<
	SurfaceDefinition,
	"types" | "views" | "operations"
> = {
	types: [
		...dagEntityTypes,
		...dagConfigurationTypes,
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
		...dagConfigurationTypes.map(({ id }) => ({
			id: `${id}.table`,
			accepts: setOf(id),
			component: EntityListView,
		})),
		{
			id: "dag.node.detail",
			accepts: objectOf("dag.node"),
			component: NodeConfigForm,
		},
		{
			id: "dag.provider.detail",
			accepts: objectOf("dag.provider"),
			component: ProviderConfigForm,
		},
		{
			id: "dag.script.detail",
			accepts: objectOf("dag.script"),
			component: ScriptDetailView,
			props: (ref) => {
				if (ref.kind === "object")
					openScriptClicked({ path: ref.id, hash: "" });
				return {};
			},
		},
		{
			id: "dag.workflow.detail",
			accepts: objectOf("dag.workflow"),
			component: WorkflowDetailView,
			props: (ref) => {
				if (ref.kind === "object")
					openWorkflowForm({ workflow: { name: ref.id } });
				return {};
			},
		},
		{
			id: "dag.variable.detail",
			accepts: objectOf("dag.variable"),
			component: VarDetailView,
			props: (ref) => {
				if (ref.kind === "object") loadVarDetail(ref.id);
				return {};
			},
		},
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
};
