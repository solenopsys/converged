import {
	defineMicrofrontend,
	objectOf,
	setOf,
} from "front-core/object-runtime";
import { ContextEditView } from "./views/ContextEditView";
import { ContextsListView } from "./views/ContextsListView";

export default defineMicrofrontend({
	id: "mf-contexts",
	types: [
		{
			id: "contexts.context",
			label: "AI context",
			pluralLabel: "AI contexts",
			categories: [
				"core.content",
				"core.selectable",
				"core.creatable",
				"core.editable",
			],
		},
	],
	views: [
		{
			id: "contexts.context.edit",
			accepts: objectOf("contexts.context"),
			component: ContextEditView,
			props: (ref) => ({
				contextId: ref.kind === "object" ? ref.id : undefined,
			}),
		},
		{
			id: "contexts.context.table",
			accepts: setOf("contexts.context"),
			component: ContextsListView,
		},
	],
	operations: [],
});
