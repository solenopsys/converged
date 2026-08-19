import {
	SHOW_CLASSIFIER_DASHBOARD,
	SHOW_CLASSIFIER_MAPPINGS,
	SHOW_CLASSIFIER_NODES,
	SHOW_CLASSIFIER_TREE,
} from "./functions";

export const MENU = {
	title: "menu.classifier",
	iconName: "IconCategory",
	action: SHOW_CLASSIFIER_DASHBOARD,
	items: [
		{
			title: "menu.classifier.mappings",
			key: "mappings",
			action: SHOW_CLASSIFIER_MAPPINGS,
		},
		{
			title: "menu.classifier.entities",
			key: "entities",
			action: SHOW_CLASSIFIER_NODES,
		},
		{
			title: "menu.classifier.tree",
			key: "tree",
			action: SHOW_CLASSIFIER_TREE,
		},
	],
};
