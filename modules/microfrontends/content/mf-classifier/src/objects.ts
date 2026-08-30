import { defineMicrofrontend, setOf } from "front-core/object-runtime";
import { ClassifierDashboardView } from "./views/ClassifierDashboardView";
import { ClassifierMappingsView } from "./views/ClassifierMappingsView";
import { ClassifierNodesView } from "./views/ClassifierNodesView";
import { ClassifierTreeView } from "./views/ClassifierTreeView";

export default defineMicrofrontend({
	id: "mf-classifier",
	types: [
		{
			id: "classifier.node",
			label: "Classifier node",
			pluralLabel: "Classifier nodes",
			categories: ["core.content", "core.selectable"],
		},
		{
			id: "classifier.mapping",
			label: "Classifier mapping",
			pluralLabel: "Classifier mappings",
			categories: ["core.content", "core.selectable"],
		},
		{
			id: "classifier.statistic",
			label: "Classifier statistic",
			pluralLabel: "Classifier statistics",
			categories: ["core.statistic"],
		},
	],
	views: [
		{
			id: "classifier.node.table",
			accepts: setOf("classifier.node"),
			component: ClassifierNodesView,
		},
		{
			id: "classifier.node.tree",
			accepts: setOf("classifier.node"),
			component: ClassifierTreeView,
			priority: 1,
		},
		{
			id: "classifier.mapping.table",
			accepts: setOf("classifier.mapping"),
			component: ClassifierMappingsView,
		},
		{
			id: "classifier.statistic.dashboard",
			accepts: setOf("classifier.statistic"),
			component: ClassifierDashboardView,
		},
	],
	operations: [],
});
