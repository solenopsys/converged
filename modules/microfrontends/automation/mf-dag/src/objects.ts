import type { SetRef } from "front-core/object-runtime";
import { defineMicrofrontend, setOf } from "front-core/object-runtime";
import { h } from "preact";
import dagService from "./service";
import { DagSummary } from "./summary";
import { DagEntityListView } from "./views/DagEntityListView";
import { StatsView } from "./views/StatsView";

const selectableTypes = [
	["dag.workflow", "Workflow", "Workflows"],
	["dag.execution", "Execution", "Executions"],
	["dag.task", "Task", "Tasks"],
	["dag.variable", "Variable", "Variables"],
] as const;

type DagEntityType = (typeof selectableTypes)[number][0];

const listView = (kind: DagEntityType) =>
	function ListView(props: { reference?: SetRef }) {
		return h(DagEntityListView, { kind, reference: props.reference });
	};

export default defineMicrofrontend({
	id: "mf-dag",
	types: [
		...selectableTypes.map(([id, label, pluralLabel]) => ({
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
		})),
		{
			id: "dag.statistic.summary",
			label: "Workflows",
			categories: ["core.statistic"],
			statistic: { role: "summary", component: DagSummary },
		},
		{
			id: "dag.statistic",
			label: "DAG statistic",
			pluralLabel: "DAG statistics",
			categories: ["core.statistic", "core.automation"],
		},
	],
	views: [
		...selectableTypes.map(([id]) => ({
			id: `${id}.table`,
			accepts: setOf(id),
			component: listView(id),
		})),
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
