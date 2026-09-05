import type { CreateAction, CreateWidget } from "front-core";
import { presentReference, setRef } from "front-core/object-runtime";
import { formReset, NodeConfigForm } from "../views/NodeConfigForm";

const SHOW_NODES_LIST = "nodes.show";
const SHOW_NODE_FORM = "node_form.show";

// Form widget - opens in sidebar
export const createNodeFormWidget: CreateWidget<typeof NodeConfigForm> = (
	bus,
) => ({
	view: NodeConfigForm,
	placement: () => "sidebar:tab:dag",
	config: {},
	commands: {
		onSave: () => {
			bus.run(SHOW_NODES_LIST, {});
		},
		onCancel: () => {
			formReset();
		},
	},
});

const createShowNodesListAction: CreateAction = () => ({
	id: SHOW_NODES_LIST,
	invoke: () => void presentReference(setRef("dag.node", { kind: "query" })),
});

const createShowNodeFormAction: CreateAction<any> = (bus) => ({
	id: SHOW_NODE_FORM,
	invoke: () => {
		bus.present({ widget: createNodeFormWidget(bus) });
	},
});

export {
	createShowNodeFormAction,
	createShowNodesListAction,
	SHOW_NODE_FORM,
	SHOW_NODES_LIST,
};

const ACTIONS = [createShowNodesListAction, createShowNodeFormAction];

export default ACTIONS;
