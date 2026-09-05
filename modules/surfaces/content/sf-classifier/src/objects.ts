import { EntityListView } from "front-core";
import { defineSurface, objectRef, setOf } from "front-core/object-runtime";
import {
	$classifierNodesStore,
	CLASSIFIER_SERVICES_GROUP,
} from "./domain-classifier";
import {
	classifierMappingColumns,
	classifierNodeColumns,
} from "./functions/columns";
import classifierService from "./service";
import { ClassifierDashboardView } from "./views/ClassifierDashboardView";
import { ClassifierTreeView } from "./views/ClassifierTreeView";

const textFilter = (filter: unknown, field: string) => {
	const value = (
		filter as Record<string, Record<string, unknown>> | undefined
	)?.[field];
	return value?.contains ?? value?.startsWith ?? value?.eq;
};

export default defineSurface({
	id: "sf-classifier",
	label: "Classifier",
	purpose: "Classification tree and the mappings that place things in it",
	types: [
		{
			id: "classifier.node",
			label: "Classifier node",
			pluralLabel: "Classifier nodes",
			categories: ["core.content", "core.selectable"],
			infinity: {
				tableId: "classifier-nodes",
				title: "Classifier nodes",
				columns: classifierNodeColumns,
				store: $classifierNodesStore,
				rowRef: (row) => objectRef("classifier.node", String(row.id)),
				filters: [
					{ id: "name", label: "Name", type: "search", operator: "contains" },
					{ id: "slug", label: "Slug", type: "search", operator: "contains" },
				],
			},
		},
		{
			id: "classifier.mapping",
			label: "Classifier mapping",
			pluralLabel: "Classifier mappings",
			categories: ["core.content", "core.selectable"],
			infinity: {
				tableId: "classifier-mappings",
				title: "Classifier mappings",
				columns: classifierMappingColumns,
				load: async (params) => {
					const mappings = await classifierService.listMappings(
						CLASSIFIER_SERVICES_GROUP,
					);
					const filtered = mappings.filter((mapping) => {
						const filter = params.filter;
						const key = textFilter(filter, "key");
						const value = textFilter(filter, "value");
						return (
							(typeof key !== "string" || mapping.key.includes(key)) &&
							(typeof value !== "string" || mapping.value.includes(value))
						);
					});
					const offset = Number(params.offset ?? 0);
					const limit = Number(params.limit ?? 50);
					return {
						items: filtered.slice(offset, offset + limit),
						totalCount: filtered.length,
					};
				},
				rowRef: (row) => objectRef("classifier.mapping", String(row.id)),
				filters: [
					{ id: "key", label: "Key", type: "search", operator: "contains" },
					{ id: "value", label: "Value", type: "search", operator: "contains" },
				],
			},
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
			component: EntityListView,
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
			component: EntityListView,
		},
		{
			id: "classifier.statistic.dashboard",
			accepts: setOf("classifier.statistic"),
			component: ClassifierDashboardView,
		},
	],
	operations: [],
});
