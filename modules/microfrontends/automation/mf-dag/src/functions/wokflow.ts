import { BasicFormView, getAllFormFields, CreateWidget, CreateAction, StatCard } from "front-core";
import { sample } from "effector";
import { workflowsFields } from "./fields";
import domain from "../domain";
import { createRuntimeDagServiceClient } from "g-rt-dag";
import { createFrontNrpcClientConfig } from "signal-channel";
import DagView from "../views/DagView";
import { WorkflowsListView } from "../views/WorkflowsListView";
import { $workflowsStore, openWorkflowForm, $currentWorkflow } from "../domain-workflows";

const dagClient = createRuntimeDagServiceClient(
	createFrontNrpcClientConfig({ target: "centimanus" }),
);

const SHOW_WORKFLOWS_LIST = "workflows.show";
const SHOW_WORKFLOW_FORM = "workflow_form.show";
const SHOW_WORKFLOW = "workflow.show";
const SHOW_WORKFLOWS_STATISTIC = "workflows.statistic.show";

// Stats store
const $workflowsStatStore = domain.createStore<number>(0);
const getWorkflowsStatEvent = domain.createEvent<any>("GET_WORKFLOWS_STAT");

const getWorkflowsStatFx = domain.createEffect({
    name: "WORKFLOWS_STAT",
    handler: () => dagClient.listWorkflows()
});

sample({
    clock: getWorkflowsStatEvent,
    target: getWorkflowsStatFx,
});

sample({
    clock: getWorkflowsStatFx.doneData,
    fn: (data) => data.names?.length || 0,
    target: $workflowsStatStore,
});

// Form fields configuration
const workflowFormFields = getAllFormFields(workflowsFields);

// Form widget - opens in sidebar
export const createWorkflowFormWidget: CreateWidget<typeof BasicFormView> = () => ({
    view: BasicFormView,
    placement: () => "sidebar:tab:dag",
    config: {
        fields: workflowFormFields,
        entityStore: $currentWorkflow,
        title: "Workflow Configuration",
        subtitle: "Configure workflow parameters"
    },
    commands: {
        onSave: async (data: any) => {
            console.log("Save workflow:", data);
        },
        onCancel: () => {
            openWorkflowForm({ workflow: null });
        }
    }
});

// Detail view widget
const createWorkflowsDetailWidget: CreateWidget<typeof DagView> = () => ({
    view: DagView,
    placement: () => "right",
    commands: {
        onNodeEvent: (nodeName, eventType) => {
            console.log("onclick", nodeName, eventType);
        }
    }
});

// Statistic widget
const createWorkflowsStatisticWidget: CreateWidget<typeof StatCard> = () => ({
    view: StatCard,
    config: {
        $value: $workflowsStatStore,
        title: "Workflows Count"
    },
    placement: () => "float",
    commands: {
        refresh: () => getWorkflowsStatEvent()
    }
});

// List widget - opens in center
const createWorkflowsListWidget: CreateWidget<typeof WorkflowsListView> = (bus) => ({
    view: WorkflowsListView,
    placement: () => "center",
    config: {
        bus
    }
});

const createShowWorkflowsListAction: CreateAction<any> = (bus) => ({
    id: SHOW_WORKFLOWS_LIST,
    llm: {
      microfrontend: "dag-mf",
      brief: "llm.actions.workflows_show.brief",
      description: "llm.actions.workflows_show.description",
    },
    exposure: "user",
    priority: "primary",
    invoke: () => {
        bus.present({ widget: createWorkflowsListWidget(bus) });
    }
});

const createShowWorkflowFormAction: CreateAction<any> = (bus) => ({
    id: SHOW_WORKFLOW_FORM,
    llm: {
      microfrontend: "dag-mf",
      brief: "llm.actions.workflow_form_show.brief",
      description: "llm.actions.workflow_form_show.description",
    },
    exposure: "user",
    priority: "primary",
    invoke: ({ workflow }: { workflow?: any }) => {
        openWorkflowForm({ workflow });
        bus.present({ widget: createWorkflowFormWidget(bus) });
    }
});

const createShowWorkflowDetailAction: CreateAction<any> = (bus) => ({
    id: SHOW_WORKFLOW,
    llm: {
      microfrontend: "dag-mf",
      brief: "llm.actions.workflow_show.brief",
      description: "llm.actions.workflow_show.description",
    },
    exposure: "user",
    priority: "primary",
    invoke: () => {
        bus.present({ widget: createWorkflowsDetailWidget(bus) });
    }
});

const createShowWorkflowsStatisticAction: CreateAction<any> = (bus) => ({
    id: SHOW_WORKFLOWS_STATISTIC,
    llm: {
      microfrontend: "dag-mf",
      brief: "llm.actions.workflows_statistic_show.brief",
      description: "llm.actions.workflows_statistic_show.description",
    },
    exposure: "user",
    priority: "normal",
    invoke: () => {
        getWorkflowsStatEvent();
        bus.present({ widget: createWorkflowsStatisticWidget(bus) });
    }
});

export {
    SHOW_WORKFLOWS_LIST,
    SHOW_WORKFLOW_FORM,
    SHOW_WORKFLOW,
    SHOW_WORKFLOWS_STATISTIC,
    createShowWorkflowsListAction,
    createShowWorkflowFormAction,
    createShowWorkflowDetailAction,
    createShowWorkflowsStatisticAction
};

const ACTIONS = [
    createShowWorkflowsListAction,
    createShowWorkflowFormAction,
    createShowWorkflowDetailAction,
    createShowWorkflowsStatisticAction
];

export default ACTIONS;
