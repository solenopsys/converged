import {
	defineMicrofrontend,
	objectOf,
	setOf,
} from "front-core/object-runtime";
import { ContextObject, contextFromRef } from "./context";
import { ContextEditView } from "./views/ContextEditView";
import { ContextsListView } from "./views/ContextsListView";

export default defineMicrofrontend({
	id: ContextObject.microfrontend,
	types: [
		{
			id: ContextObject.type,
			label: "AI context",
			pluralLabel: "AI contexts",
		},
	],
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
