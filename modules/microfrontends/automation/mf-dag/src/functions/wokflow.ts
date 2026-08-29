import { sample } from "effector";
import {
	BasicFormView,
	type CreateAction,
	type CreateWidget,
	getAllFormFields,
	StatCard,
} from "front-core";
import { createDagServiceClient } from "g-dag";
import { createFrontNrpcClientConfig } from "signal-channel";
import domain from "../domain";
import { $currentWorkflow, openWorkflowForm } from "../domain-workflows";
import DagView from "../views/DagView";
import { WorkflowsListView } from "../views/WorkflowsListView";
import { workflowsFields } from "./fields";

const dagClient = createDagServiceClient(createFrontNrpcClientConfig());

const SHOW_WORKFLOWS_LIST = "workflows.show";
const SHOW_WORKFLOW_FORM = "workflow_form.show";
const SHOW_WORKFLOW = "workflow.show";
const SHOW_WORKFLOWS_STATISTIC = "workflows.statistic.show";

// Stats store
const $workflowsStatStore = domain.createStore<number>(0);
const getWorkflowsStatEvent = domain.createEvent<any>("GET_WORKFLOWS_STAT");

const getWorkflowsStatFx = domain.createEffect({
	name: "WORKFLOWS_STAT",
	handler: () => dagClient.listAvailableWorkflows(),
});

sample({
	clock: getWorkflowsStatEvent,
	target: getWorkflowsStatFx,
});

sample({
	clock: getWorkflowsStatFx.doneData,
	fn: (data) => data.items?.length || 0,
	target: $workflowsStatStore,
});

// Form fields configuration
const workflowFormFields = getAllFormFields(workflowsFields);

// Form widget - opens in sidebar
export const createWorkflowFormWidget: CreateWidget<
	typeof BasicFormView
> = () => ({
	view: BasicFormView,
	placement: () => "sidebar:tab:dag",
	config: {
		fields: workflowFormFields,
		entityStore: $currentWorkflow,
		title: "Workflow Configuration",
		subtitle: "Configure workflow parameters",
	},
	commands: {
		onSave: async (data: any) => {
			console.log("Save workflow:", data);
		},
		onCancel: () => {
			openWorkflowForm({ workflow: null });
		},
	},
});

// Detail view widget
const createWorkflowsDetailWidget: CreateWidget<typeof DagView> = () => ({
	view: DagView,
	placement: () => "right",
	commands: {
		onNodeEvent: (nodeName, eventType) => {
			console.log("onclick", nodeName, eventType);
		},
	},
});

// Statistic widget
const createWorkflowsStatisticWidget: CreateWidget<typeof StatCard> = () => ({
	view: StatCard,
	config: {
		$value: $workflowsStatStore,
		title: "Workflows Count",
	},
	placement: () => "float",
	commands: {
		refresh: () => getWorkflowsStatEvent(),
	},
});

// List widget - opens in center
const createWorkflowsListWidget: CreateWidget<typeof WorkflowsListView> = (
	bus,
) => ({
	view: WorkflowsListView,
	placement: () => "center",
	config: {
		bus,
	},
});

const createShowWorkflowsListAction: CreateAction<any> = (bus) => ({
	id: SHOW_WORKFLOWS_LIST,
	invoke: () => {
		bus.present({ widget: createWorkflowsListWidget(bus) });
	},
});

const createShowWorkflowFormAction: CreateAction<any> = (bus) => ({
	id: SHOW_WORKFLOW_FORM,
	invoke: ({ workflow }: { workflow?: any }) => {
		openWorkflowForm({ workflow });
		bus.present({ widget: createWorkflowFormWidget(bus) });
	},
});

const createShowWorkflowDetailAction: CreateAction<any> = (bus) => ({
	id: SHOW_WORKFLOW,
	invoke: () => {
		bus.present({ widget: createWorkflowsDetailWidget(bus) });
	},
});

const createShowWorkflowsStatisticAction: CreateAction<any> = (bus) => ({
	id: SHOW_WORKFLOWS_STATISTIC,
	invoke: () => {
		getWorkflowsStatEvent();
		bus.present({ widget: createWorkflowsStatisticWidget(bus) });
	},
});

export {
	createShowWorkflowDetailAction,
	createShowWorkflowFormAction,
	createShowWorkflowsListAction,
	createShowWorkflowsStatisticAction,
	SHOW_WORKFLOW,
	SHOW_WORKFLOW_FORM,
	SHOW_WORKFLOWS_LIST,
	SHOW_WORKFLOWS_STATISTIC,
};

const ACTIONS = [
	createShowWorkflowsListAction,
	createShowWorkflowFormAction,
	createShowWorkflowDetailAction,
	createShowWorkflowsStatisticAction,
];

export default ACTIONS;
