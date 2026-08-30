import {
	defineMicrofrontend,
	objectOf,
	objectRef,
	setOf,
} from "front-core/object-runtime";
import dagService from "./service";
import { ContextsView } from "./views/ContextsView";
import DagView from "./views/DagView";
import { ExecutionsView } from "./views/ExecutionsView";
import { createNodeFx, NodeConfigForm } from "./views/NodeConfigForm";
import { NodesListView } from "./views/NodesListView";
import {
	createProviderFx,
	ProviderConfigForm,
} from "./views/ProviderConfigForm";
import { ProvidersListView } from "./views/ProvidersListView";
import { ScriptsListView } from "./views/ScriptsListView";
import { StatsView } from "./views/StatsView";
import { TasksView } from "./views/TasksView";
import { VarsView } from "./views/VarsView";
import { WorkflowsListView } from "./views/WorkflowsListView";

const definitions = [
	["dag.workflow", "Workflow", "Workflows"],
	["dag.node", "Node", "Nodes"],
	["dag.provider", "Provider", "Providers"],
	["dag.context", "Execution context", "Execution contexts"],
	["dag.execution", "Execution", "Executions"],
	["dag.task", "Task", "Tasks"],
	["dag.variable", "Variable", "Variables"],
	["dag.script", "DAG script", "DAG scripts"],
] as const;

export default defineMicrofrontend({
	id: "mf-dag",
	types: [
		...definitions.map(([id, label, pluralLabel]) => ({
			id,
			label,
			pluralLabel,
			categories: ["core.automation", "core.selectable", "core.executable"],
		})),
		{
			id: "dag.statistic",
			label: "DAG statistic",
			pluralLabel: "DAG statistics",
			categories: ["core.statistic", "core.automation"],
		},
	],
	views: [
		{
			id: "dag.workflow.detail",
			accepts: objectOf("dag.workflow"),
			component: DagView,
		},
		{
			id: "dag.workflow.table",
			accepts: setOf("dag.workflow"),
			component: WorkflowsListView,
		},
		{
			id: "dag.node.form",
			accepts: objectOf("dag.node"),
			component: NodeConfigForm,
		},
		{
			id: "dag.node.table",
			accepts: setOf("dag.node"),
			component: NodesListView,
		},
		{
			id: "dag.provider.form",
			accepts: objectOf("dag.provider"),
			component: ProviderConfigForm,
		},
		{
			id: "dag.provider.table",
			accepts: setOf("dag.provider"),
			component: ProvidersListView,
		},
		{
			id: "dag.context.table",
			accepts: setOf("dag.context"),
			component: ContextsView,
		},
		{
			id: "dag.execution.table",
			accepts: setOf("dag.execution"),
			component: ExecutionsView,
		},
		{ id: "dag.task.table", accepts: setOf("dag.task"), component: TasksView },
		{
			id: "dag.variable.table",
			accepts: setOf("dag.variable"),
			component: VarsView,
		},
		{
			id: "dag.script.table",
			accepts: setOf("dag.script"),
			component: ScriptsListView,
		},
		{
			id: "dag.statistic.dashboard",
			accepts: setOf("dag.statistic"),
			component: StatsView,
		},
	],
	operations: [
		{
			id: "dag.node.create",
			operator: "create",
			target: "dag.node",
			label: "Create node",
			output: objectOf("dag.node"),
			parameters: { type: "object", properties: {} },
			invoke: async ({ params }) =>
				objectRef(
					"dag.node",
					String(
						(await createNodeFx(params as any))?.id ??
							params.name ??
							crypto.randomUUID(),
					),
				),
		},
		{
			id: "dag.provider.create",
			operator: "create",
			target: "dag.provider",
			label: "Create provider",
			output: objectOf("dag.provider"),
			parameters: { type: "object", properties: {} },
			invoke: async ({ params }) =>
				objectRef(
					"dag.provider",
					String(
						(await createProviderFx(params as any))?.id ??
							params.name ??
							crypto.randomUUID(),
					),
				),
		},
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
