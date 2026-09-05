import { EntityListView } from "front-core";
import {
	Category,
	defineSurface,
	type ObjectDefinition,
	objectOf,
	objectRef,
	setOf,
} from "front-core/object-runtime";
import type { ContextListParams } from "g-contexts";
import { contextsColumns } from "./config";
import { ContextObject, contextFromRef } from "./context";
import { contextsClient } from "./services";
import { ContextEditView } from "./views/ContextEditView";

const languageFromFilter = (params: Record<string, unknown>) => {
	const filter = params.filter;
	if (!filter || typeof filter !== "object") return undefined;
	const clause = (filter as Record<string, unknown>).language;
	if (!clause || typeof clause !== "object") return undefined;
	const value = (clause as Record<string, unknown>).eq;
	return typeof value === "string" && value.trim() ? value : undefined;
};

export const objects = [
	{
		id: ContextObject.type,
		label: "AI context",
		pluralLabel: "AI contexts",
		categories: [Category.Content, Category.Selectable, Category.Editable],
		infinity: {
			tableId: "contexts",
			title: "Contexts",
			columns: contextsColumns,
			load: (params) => {
				const language = languageFromFilter(params);
				const request: ContextListParams = {
					offset: typeof params.offset === "number" ? params.offset : 0,
					limit: typeof params.limit === "number" ? params.limit : 100,
					...(language ? { language } : {}),
					...(params.filter && typeof params.filter === "object"
						? { filter: params.filter as ContextListParams["filter"] }
						: {}),
				};
				return contextsClient.listContexts(request);
			},
			rowRef: (context) =>
				objectRef(ContextObject.type, `${context.language}:${context.name}`, {
					title: typeof context.name === "string" ? context.name : undefined,
				}),
			filters: [
				{
					id: "language",
					label: "Language",
					type: "search",
					operator: "eq",
				},
			],
		},
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
			component: EntityListView,
		},
	],
	operations: [],
});
