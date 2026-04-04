import { CreateWidget, CreateAction } from "front-core";
import { NodesListView } from "../views/NodesListView";
import { NodeConfigForm, formReset } from "../views/NodeConfigForm";

const SHOW_NODES_LIST = "nodes.show";
const SHOW_NODE_FORM = "node_form.show";

// Form widget - opens in sidebar
export const createNodeFormWidget: CreateWidget<typeof NodeConfigForm> = (bus) => ({
    view: NodeConfigForm,
    placement: () => "sidebar:tab:dag",
    config: {},
    commands: {
        onSave: () => {
            bus.run(SHOW_NODES_LIST, {});
        },
        onCancel: () => {
            formReset();
        }
    }
});

// List widget - opens in center
const createNodesListWidget: CreateWidget<typeof NodesListView> = (bus) => ({
    view: NodesListView,
    placement: () => "center",
    config: {
        bus
    }
});

// Actions
const createShowNodesListAction: CreateAction<any> = (bus) => ({
    id: SHOW_NODES_LIST,
    description: "Show nodes list",
    invoke: () => {
        bus.present({ widget: createNodesListWidget(bus) });
    }
});

const createShowNodeFormAction: CreateAction<any> = (bus) => ({
    id: SHOW_NODE_FORM,
    description: "Show node form",
    invoke: () => {
        bus.present({ widget: createNodeFormWidget(bus) });
    }
});

export {
    SHOW_NODES_LIST,
    SHOW_NODE_FORM,
    createShowNodesListAction,
    createShowNodeFormAction,
};

const ACTIONS = [
    createShowNodesListAction,
    createShowNodeFormAction,
];

export default ACTIONS;
