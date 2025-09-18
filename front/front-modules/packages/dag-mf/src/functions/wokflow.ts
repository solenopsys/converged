import dagClient from "../service";
import {ListView} from "converged-core"; // Добавил недостающий импорт
import DagView from "../views/DagView"; // Добавил недостающий импорт
import { CreateAction, CreateWidget, StatCard } from "converged-core"; 
import { sample } from "effector";
import domain from "../domain";
import { createDataFlow } from "src/helpers";

const SHOW_WORKFLOWS_LIST = "show_workflows_list";
const GET_WORKFLOWS_LIST = "get_workflows_list";
const SHOW_WORKFLOWS_STATISTIC = "show_workflows_statistic";
const GET_WORKFLOWS_STATISTIC = "get_workflows_statistic";
const SHOW_WORKFLOW = "show_workflow";

const workflowListFx = domain.createEffect<any, any>();
const getWorkflowsStatFx = domain.createEffect<any, any>();
const showWorkflowEvent = domain.createEvent<{ workflowId: string }>();
const openWorkflowEvent = domain.createEvent<{ id: string }>();
const getWorkflowsStatEvent = domain.createEvent<any>();
const getWorkflowsListEvent = domain.createEvent<any>();


sample({ clock: getWorkflowsStatEvent, target: getWorkflowsStatFx });
sample({ clock: getWorkflowsListEvent, target: workflowListFx });
sample({ clock: openWorkflowEvent, target: workflowListFx });

export const getWorkflowsStatRequest = createDataFlow(
    () => dagClient.workflowList(),
    (names) => names.length
);

export const getWorkflowsListRequest = createDataFlow(
    () => dagClient.workflowList(),
    (names) => names.map((name: string) => ({ id: name, title: name }))
);

const createWorkflowsStatisticWidget: CreateWidget<typeof StatCard> = () => ({
    view: StatCard,
    placement: () => "float",
    mount: () => getWorkflowsStatRequest(),
    commands: {
        refresh: () => getWorkflowsStatRequest()
    }
});

const createWorkflowsDetailWidget: CreateWidget<typeof DagView> = () => ({
    view: DagView,
    placement: () => "right",
    commands: {  
        onNodeEvent: (nodeName, eventType) => {
            console.log("onclick", nodeName, eventType);
        }
    }
});

const createWorkflowsListWidget: CreateWidget<typeof ListView> = () => ({
    view: ListView,
    placement: () => "center",
    mount: async () => {
        const data = await workflowListFx();
        return {
            items: data || [],
            title: "Workflows"
        }
    },
    commands: {
        onSelect: (id) => {
            console.log("SELECT", id);
            openWorkflowEvent({ id });
        }
    }
});

const createShowWorkflowsDetailAction: CreateAction<any> = (bus) => ({
    id: SHOW_WORKFLOW,
    description: "Show workflow",
    invoke: () => {
        bus.present(createWorkflowsDetailWidget(bus));
    }
});

const createShowWorkflowsListAction: CreateAction<any> = (bus) => ({
    id: SHOW_WORKFLOWS_LIST,
    description: "Show workflows list",
    invoke: () => {
        bus.present(createWorkflowsListWidget(bus));
    }
});

const createGetWorkflowsListAction: CreateAction<any> = (bus) => ({
    id: GET_WORKFLOWS_LIST,
    description: "Get workflows list",
    invoke: (params) => getWorkflowsListRequest({ ...params, bus })
});

const createShowWorkflowsStatisticAction: CreateAction<any> = (bus) => ({
    id: SHOW_WORKFLOWS_STATISTIC,
    description: "Show workflows statistic",
    invoke: () => {
        bus.present(createWorkflowsStatisticWidget(bus));
    }
});

const createGetWorkflowsStatisticAction: CreateAction<any> = (bus) => ({
    id: GET_WORKFLOWS_STATISTIC,
    description: "Get workflows statistic",
    invoke: (params) => getWorkflowsStatRequest({ ...params, bus })
});

export {
    SHOW_WORKFLOWS_LIST,
    GET_WORKFLOWS_LIST,
    SHOW_WORKFLOWS_STATISTIC,
    GET_WORKFLOWS_STATISTIC,
    SHOW_WORKFLOW,
    createShowWorkflowsDetailAction,
    createShowWorkflowsListAction,
    createGetWorkflowsListAction,
    createShowWorkflowsStatisticAction,
    createGetWorkflowsStatisticAction
};

const ACTIONS = [
    createShowWorkflowsDetailAction,
    createShowWorkflowsListAction,
    createGetWorkflowsListAction,
    createShowWorkflowsStatisticAction,
    createGetWorkflowsStatisticAction
];

export default ACTIONS;