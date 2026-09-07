import { EntityListView, Plus } from "front-core";
import type {
	InfinityDefinition,
	ObjectDefinition,
	SurfaceDefinition,
} from "front-core/object-runtime";
import { objectOf, objectRef, setOf } from "front-core/object-runtime";
import type { PaginationParams, WorkflowTrigger } from "g-dag";
import { openExecution } from "./domain-executions";
import { addTriggerClicked, openTriggerForm } from "./domain-triggers";
import { openRunForm } from "./domain-workflows";
import {
	executionsColumns,
	triggersColumns,
	workflowsColumns,
} from "./functions/columns";
import dagService from "./service";
import { DagSummary } from "./summary";
import { ExecutionTreeView } from "./views/ExecutionTreeView";
import { RunWorkflowView } from "./views/RunWorkflowView";
import { StatsView } from "./views/StatsView";
import { TriggerFormView } from "./views/TriggerFormView";

const infinity: Record<string, InfinityDefinition> = {
	"dag.workflow": {
		tableId: "dag-workflows",
		title: "Workflows",
		columns: workflowsColumns,
		load: (params) => dagService.listWorkflows(params as PaginationParams),
		rowRef: (row) =>
			objectRef("dag.workflow", String(row.script ?? row.name), {
				title: typeof row.name === "string" ? row.name : undefined,
			}),
		filters: [
			{ id: "name", label: "Workflow", type: "search", operator: "contains" },
			{ id: "script", label: "Script", type: "search", operator: "contains" },
		],
	},
	"dag.execution": {
		tableId: "dag-executions",
		title: "Runs",
		columns: executionsColumns,
		load: (params) => dagService.listExecutions(params as PaginationParams),
		rowRef: (row) => objectRef("dag.execution", String(row.id)),
		filters: [
			{ id: "workflow", label: "Workflow", type: "search", operator: "eq" },
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
	"dag.trigger": {
		tableId: "dag-triggers",
		title: "Triggers",
		columns: triggersColumns,
		load: (params) => dagService.listTriggers(params as PaginationParams),
		rowRef: (row) =>
			objectRef("dag.trigger", String(row.id), {
				title: typeof row.name === "string" ? row.name : undefined,
			}),
		filters: [
			{ id: "name", label: "Name", type: "search", operator: "contains" },
			{ id: "topic", label: "Topic", type: "search", operator: "contains" },
		],
		actions: [
			{
				id: "add",
				label: "New trigger",
				icon: Plus,
				event: addTriggerClicked,
				variant: "default" as const,
			},
		],
	},
};

const selectionLoad: Record<string, (params: any) => Promise<any>> = {
	"dag.workflow": (params) => dagService.listWorkflows(params),
	"dag.execution": (params) => dagService.listExecutions(params),
	"dag.trigger": (params) => dagService.listTriggers(params),
};

const types: ObjectDefinition[] = (
	[
		["dag.workflow", "Workflow", "Workflows"],
		["dag.execution", "Run", "Runs"],
		["dag.trigger", "Trigger", "Triggers"],
	] as const
).map(([id, label, pluralLabel]) => ({
	id,
	label,
	pluralLabel,
	categories: ["core.automation", "core.selectable"],
	selection: {
		filters: [],
		describe: () => dagService.describeSelection(id),
		load: (params) => selectionLoad[id](params),
		inspect: (filter) => dagService.inspectSelection(id, filter),
	},
	infinity: infinity[id],
}));

export const dagContribution: Pick<
	SurfaceDefinition,
	"types" | "views" | "operations"
> = {
	types: [
		...types,
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
		...types.map(({ id }) => ({
			id: `${id}.table`,
			accepts: setOf(id),
			component: EntityListView,
		})),
		{
			// Opening a workflow is asking to run it: the catalogue is read-only,
			// so there is nothing else to do with one from here.
			id: "dag.workflow.detail",
			accepts: objectOf("dag.workflow"),
			component: RunWorkflowView,
			props: (ref) => {
				if (ref.kind === "object") openRunForm({ script: ref.id });
				return {};
			},
		},
		{
			id: "dag.execution.detail",
			accepts: objectOf("dag.execution"),
			component: ExecutionTreeView,
			props: (ref) => {
				if (ref.kind === "object") openExecution(ref.id);
				return {};
			},
		},
		{
			id: "dag.trigger.detail",
			accepts: objectOf("dag.trigger"),
			component: TriggerFormView,
			props: (ref) => {
				if (ref.kind === "object") loadTrigger(ref.id);
				return {};
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
			id: "dag.trigger.create",
			operator: "create",
			target: "dag.trigger",
			label: "New trigger",
			parameters: { type: "object", properties: {} },
			invoke: () => {
				openTriggerForm({ trigger: null });
				return Promise.resolve();
			},
		},
	],
};

/**
 * The list holds the row; the form wants the record, so fetch the one row.
 * `new` is not a row — it is how the header button asks for a blank form.
 */
async function loadTrigger(id: string): Promise<void> {
	if (id === "new") {
		openTriggerForm({ trigger: null });
		return;
	}
	const result = await dagService.listTriggers({
		offset: 0,
		limit: 1,
		filter: { id: { eq: id } },
	});
	const trigger = (result.items?.[0] as WorkflowTrigger) ?? null;
	openTriggerForm({ trigger });
}
