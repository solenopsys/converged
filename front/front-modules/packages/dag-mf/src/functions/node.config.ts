import dagClient from "../service";
import { NodeFormView } from "../views/NodeFormView";
import { ListView } from "converged-core";
import { CreateAction, CreateWidget, StatCard } from "converged-core";
import { sample } from "effector";
import domain from "../domain";

const SHOW_NODES_LIST = "show_nodes_list";
const GET_NODES_LIST = "get_nodes_list";
const EDIT_NODE = "edit_node";

const $nodesStore = domain.createStore<{ id: string, title: string }[]>([]);
const openNodeEvent = domain.createEvent<{ id: string }>("OPEN_NODE");
const editNodeEvent = domain.createEvent<{ nodeId: string }>("EDIT_NODE");
const getNodesListEvent = domain.createEvent<any>("GET_NODES_LIST");

export const nodeListFx = domain.createEffect({
    name: "NODE_LIST",
    handler: () => dagClient.nodeList() // возвращает массив строк    
});

export const editNodeFx = domain.createEffect({
    name: "EDIT_NODE",
    handler: (nodeData) => dagClient.editNode(nodeData) // обработка редактирования узла
});

sample({
    clock: getNodesListEvent,          // когда срабатывает запрос
    filter: $nodesStore.map(items => items.length === 0),
    target: nodeListFx,       // запускаем эффект
});

sample({
    clock: editNodeEvent,
    target: editNodeFx,
});

sample({
    clock: nodeListFx.doneData,
    fn: (data) => {
        console.log('nodeListFx result:', data); // проверьте структуру
        return data.names.map(name => ({ id: name, title: name }));
    },
    target: $nodesStore,
});

const createEditNodeWidget: CreateWidget<typeof NodeFormView> = () => ({
    view: NodeFormView,
    placement: () => "center",
    commands: {
        onSave: (nodeData) => {
            console.log("SAVE NODE", nodeData);
            editNodeEvent({ nodeId: nodeData.id, ...nodeData });
        },
        onCancel: () => {
            console.log("CANCEL EDIT");
        }
    }
});

const createNodesListWidget: CreateWidget<typeof ListView> = () => ({
    view: ListView,
    config: {
        $items: $nodesStore,
        title: "Nodes"
    },
    placement: () => "center",
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
        getNodesListEvent();
        bus.present(createNodesListWidget(bus));
    }
});

const createGetNodesListAction: CreateAction<any> = (bus) => ({ // tut nuzhno kuda vozvrashchat'
    id: GET_NODES_LIST,
    description: "Get nodes list",
    invoke: (params) => {
        getNodesListEvent({ ...params, bus });
        //  bus.respond(resolveStore($nodesStore),params.id);
    }
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