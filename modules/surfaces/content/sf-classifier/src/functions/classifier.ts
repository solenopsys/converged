import type { CreateAction, CreateWidget } from "front-core";
import { presentReference, setRef } from "front-core/object-runtime";
import { ClassifierDashboardView } from "../views/ClassifierDashboardView";
import { ClassifierTreeView } from "../views/ClassifierTreeView";

const SHOW_CLASSIFIER_DASHBOARD = "classifier.dashboard.show";
const SHOW_CLASSIFIER_MAPPINGS = "classifier.mappings.show";
const SHOW_CLASSIFIER_NODES = "classifier.nodes.show";
const SHOW_CLASSIFIER_TREE = "classifier.tree.show";

const createClassifierDashboardWidget: CreateWidget<
	typeof ClassifierDashboardView
> = (bus) => ({
	view: ClassifierDashboardView,
	placement: () => "center",
	config: { bus },
});

const createClassifierTreeWidget: CreateWidget<typeof ClassifierTreeView> = (
	bus,
) => ({
	view: ClassifierTreeView,
	placement: () => "center",
	config: { bus },
});

const createShowClassifierDashboardAction: CreateAction<any> = (bus) => ({
	id: SHOW_CLASSIFIER_DASHBOARD,
	invoke: () => {
		bus.present({ widget: createClassifierDashboardWidget(bus) });
	},
});

const createShowClassifierMappingsAction: CreateAction = () => ({
	id: SHOW_CLASSIFIER_MAPPINGS,
	invoke: () =>
		void presentReference(setRef("classifier.mapping", { kind: "query" })),
});

const createShowClassifierNodesAction: CreateAction = () => ({
	id: SHOW_CLASSIFIER_NODES,
	invoke: () =>
		void presentReference(setRef("classifier.node", { kind: "query" })),
});

const createShowClassifierTreeAction: CreateAction<any> = (bus) => ({
	id: SHOW_CLASSIFIER_TREE,
	invoke: () => {
		bus.present({ widget: createClassifierTreeWidget(bus) });
	},
});

const ACTIONS = [
	createShowClassifierDashboardAction,
	createShowClassifierMappingsAction,
	createShowClassifierNodesAction,
	createShowClassifierTreeAction,
];

export {
	createShowClassifierDashboardAction,
	createShowClassifierMappingsAction,
	createShowClassifierNodesAction,
	createShowClassifierTreeAction,
	SHOW_CLASSIFIER_DASHBOARD,
	SHOW_CLASSIFIER_MAPPINGS,
	SHOW_CLASSIFIER_NODES,
	SHOW_CLASSIFIER_TREE,
};
export default ACTIONS;
