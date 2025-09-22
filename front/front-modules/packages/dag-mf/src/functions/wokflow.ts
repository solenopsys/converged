import dagClient from "../service";
import { ListView } from "converged-core";
import DagView from "../views/DagView";
import { CreateAction, CreateWidget, StatCard } from "converged-core";
import { sample } from "effector";
import domain from "../domain";

const SHOW_WORKFLOWS_LIST = "show_workflows_list";
const GET_WORKFLOWS_LIST = "get_workflows_list";
const SHOW_WORKFLOWS_STATISTIC = "show_workflows_statistic";
const GET_WORKFLOWS_STATISTIC = "get_workflows_statistic";
const SHOW_WORKFLOW = "show_workflow";

const $workflowsStore = domain.createStore<{ id: string, title: string }[]>([]);
const $workflowsStatStore = domain.createStore<number>(0);
const showWorkflowEvent = domain.createEvent<{ workflowId: string }>("SHOW_WORKFLOW");
const openWorkflowEvent = domain.createEvent<{ id: string }>("OPEN_WORKFLOW");
const getWorkflowsStatEvent = domain.createEvent<any>("GET_WORKFLOWS_STAT");
const getWorkflowsListEvent = domain.createEvent<any>("GET_WORKFLOWS_LIST");

export const workflowListFx = domain.createEffect({
    name: "WORKFLOW_LIST",
    handler: () => dagClient.workflowList() // возвращает массив строк    
});

export const getWorkflowsStatFx = domain.createEffect({
    name: "WORKFLOWS_STAT",
    handler: () => dagClient.workflowList() // возвращает массив строк для подсчета
});

sample({
    clock: getWorkflowsListEvent,          // когда срабатывает запрос списка
    filter: $workflowsStore.map(items => items.length === 0),
    target: workflowListFx,       // запускаем эффект
});

sample({
    clock: getWorkflowsStatEvent,          // когда срабатывает запрос статистики
    target: getWorkflowsStatFx,       // запускаем эффект
});

sample({
    clock: workflowListFx.doneData,
    fn: (data) => {
        console.log('workflowListFx result:', data); // проверьте структуру
        return data.names.map(name => ({ id: name, title: name }));
    },
    target: $workflowsStore,
});

sample({
    clock: getWorkflowsStatFx.doneData,
    fn: (data) => {
        console.log('getWorkflowsStatFx result:', data); // проверьте структуру
        return data.length;
    },
    target: $workflowsStatStore,
});

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
    config: {
        $items: $workflowsStore,
        title: "Workflows"
    },
    placement: () => "center",
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
        bus.present({ widget: createWorkflowsDetailWidget(bus) });
    }
});

const createShowWorkflowsListAction: CreateAction<any> = (bus) => ({
    id: SHOW_WORKFLOWS_LIST,
    description: "Show workflows list",
    invoke: () => {
        getWorkflowsListEvent();
        bus.present({ widget: createWorkflowsListWidget(bus) });
    }
});

const createGetWorkflowsListAction: CreateAction<any> = (bus) => ({ // tut nuzhno kuda vozvrashchat'
    id: GET_WORKFLOWS_LIST,
    description: "Get workflows list",
    invoke: (params) => {
        getWorkflowsListEvent({ ...params, bus });
        //  bus.respond(resolveStore($workflowsStore),params.id);
    }
});

const createShowWorkflowsStatisticAction: CreateAction<any> = (bus) => ({
    id: SHOW_WORKFLOWS_STATISTIC,
    description: "Show workflows statistic",
    invoke: () => {
        getWorkflowsStatEvent();
        bus.present({ widget: createWorkflowsStatisticWidget(bus) });
    }
});

const createGetWorkflowsStatisticAction: CreateAction<any> = (bus) => ({ // tut nuzhno kuda vozvrashchat'
    id: GET_WORKFLOWS_STATISTIC,
    description: "Get workflows statistic",
    invoke: (params) => {
        getWorkflowsStatEvent({ ...params, bus });
        //  bus.respond(resolveStore($workflowsStatStore),params.id);
    }
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