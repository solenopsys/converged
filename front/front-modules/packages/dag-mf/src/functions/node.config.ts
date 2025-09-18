import dagClient from "../service";
import NodeFormView from "../views/NodeFormView"; // Добавил недостающий импорт
import {ListView} from "converged-core"; // Добавил недостающий импорт
import { CreateAction, CreateWidget, StatCard } from "converged-core"; 
import {createEvent,createEffect, sample } from "effector";
import domain from "../domain";
import { createDataFlow } from "src/helpers";

const SHOW_NODES_LIST = "show_nodes_list";
const GET_NODES_LIST = "get_nodes_list";
const EDIT_NODE = "edit_node";

const nodeListFx =domain.createEffect<any, any>();
const editNodeFx =domain.createEffect<any, any>();
const openNodeEvent =domain.createEvent<{ id: string }>();
const editNodeEvent =domain.createEvent<{ nodeId: string }>();
const getNodesListEvent =domain.createEvent<any>();

sample({ clock: openNodeEvent, target: nodeListFx });
sample({ clock: editNodeEvent, target: editNodeFx });
sample({ clock: getNodesListEvent, target: nodeListFx });

export const getNodesListRequest = createDataFlow(
    () => dagClient.nodeList(),
    (names) => names.map((name: string) => ({ id: name, title: name }))
);

const createEditNodeWidget: CreateWidget<typeof NodeForm> = () => ({
    view: NodeForm,
    placement: () => "center",
    mount: () => { },
    commands: {
        
    }
});

const createNodesListWidget: CreateWidget<typeof ListView> = () => ({
    view: ListView,
    placement: () => "center",
    mount: async () => {
        const data = await nodeListFx();
        console.log("NODES LIST", data);
        return {
            items: data || [],
            title: "Nodes"
        }
    },
    commands: {
        onSelect: (id) => {
            console.log("SELECT", id);
            openNodeEvent({ id });
        }
    }
});

const createEditNodeAction: CreateAction<any> = (bus) => ({
    id: EDIT_NODE,
    description: "Edit node",
    invoke: () => {
        bus.present(createEditNodeWidget(bus));
    }
});

const createShowNodesListAction: CreateAction<any> = (bus) => ({
    id: SHOW_NODES_LIST,
    description: "Show nodes list",
    invoke: () => {
        bus.present(createNodesListWidget(bus));
    }
});

const createGetNodesListAction: CreateAction<any> = (bus) => ({
    id: GET_NODES_LIST,
    description: "Get nodes list",
    invoke: (params) => getNodesListRequest({ ...params, bus })
});

export {
    SHOW_NODES_LIST,
    GET_NODES_LIST,
    EDIT_NODE,
    createEditNodeAction,
    createShowNodesListAction,
    createGetNodesListAction
};

const ACTIONS = [
    createEditNodeAction,
    createShowNodesListAction,
    createGetNodesListAction
];

export default ACTIONS;