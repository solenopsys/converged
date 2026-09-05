import {
	Category,
	defineSurface,
	type ObjectDefinition,
	objectOf,
	setOf,
} from "front-core/object-runtime";
import { ContextObject, contextFromRef } from "./context";
import { ContextEditView } from "./views/ContextEditView";
import { ContextsListView } from "./views/ContextsListView";

export const objects = [
	{
		id: ContextObject.type,
		label: "AI context",
		pluralLabel: "AI contexts",
		categories: [Category.Content, Category.Selectable, Category.Editable],
	},
] satisfies readonly ObjectDefinition[];

export default defineSurface({
	id: ContextObject.surface,
	label: "Contexts",
	purpose: "Prompt contexts the assistant is given before it answers",
	types: objects,
	views: [
		{
			id: ContextObject.view.editor,
			accepts: objectOf(ContextObject.type),
			component: ContextEditView,
			props: (ref) =>
				ref.kind === "object" ? (contextFromRef(ref) ?? {}) : {},
		},
		{
			id: ContextObject.view.list,
			accepts: setOf(ContextObject.type),
			component: ContextsListView,
		},
	],
	operations: [],
});
