import { CreateAction, CreateWidget } from "front-core";
import { ClassifierDashboardView } from "../views/ClassifierDashboardView";
import { ClassifierMappingsView } from "../views/ClassifierMappingsView";
import { ClassifierNodesView } from "../views/ClassifierNodesView";
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

const createClassifierMappingsWidget: CreateWidget<
	typeof ClassifierMappingsView
> = (bus) => ({
	view: ClassifierMappingsView,
	placement: () => "center",
	config: { bus },
});

const createClassifierNodesWidget: CreateWidget<typeof ClassifierNodesView> = (
	bus,
) => ({
	view: ClassifierNodesView,
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
	description: "Show classifier dashboard",
	invoke: () => {
		bus.present({ widget: createClassifierDashboardWidget(bus) });
	},
});

const createShowClassifierMappingsAction: CreateAction<any> = (bus) => ({
	id: SHOW_CLASSIFIER_MAPPINGS,
	description: "Show classifier mappings",
	invoke: () => {
		bus.present({ widget: createClassifierMappingsWidget(bus) });
	},
});

const createShowClassifierNodesAction: CreateAction<any> = (bus) => ({
	id: SHOW_CLASSIFIER_NODES,
	description: "Show classifier entities",
	invoke: () => {
		bus.present({ widget: createClassifierNodesWidget(bus) });
	},
});

const createShowClassifierTreeAction: CreateAction<any> = (bus) => ({
	id: SHOW_CLASSIFIER_TREE,
	description: "Show classifier tree",
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
	SHOW_CLASSIFIER_DASHBOARD,
	SHOW_CLASSIFIER_MAPPINGS,
	SHOW_CLASSIFIER_NODES,
	SHOW_CLASSIFIER_TREE,
	createShowClassifierDashboardAction,
	createShowClassifierMappingsAction,
	createShowClassifierNodesAction,
	createShowClassifierTreeAction,
};
export default ACTIONS;
