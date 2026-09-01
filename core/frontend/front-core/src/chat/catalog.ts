import {
	catalogEntries,
	catalogEntry,
	invokeCatalogEntry,
	loadObjectType,
	microfrontendDeclared,
	microfrontendRegistered,
	type OperatorCatalogEntry,
	objectRegistry,
	onOperationAuthorizationChanged,
	operatorCatalogEntries,
	searchOperatorCatalog,
} from "front-core/object-runtime";
import { loadSelectionDescriptor } from "../select/descriptor";
import { activeSelection } from "../select/runtime";
import { selectCommandSchema } from "../select/schema";
import type { ChatCatalog } from "./store";

type FunctionParameters = {
	type: "object";
	properties: Record<string, unknown>;
	required?: string[];
};

function label(id: string): string | undefined {
	return catalogEntry(id)?.brief;
}

function categories() {
	return [{ id: "operator", count: catalogEntries().length }];
}

// The operator's parameters carry every target type the resolver knows, which
// is the point of `describeFunction` and far too much for a listing: a bare
// `listFunctions` would answer with the whole registry seven times over.
function briefs(entries: OperatorCatalogEntry[]) {
	return entries.map(({ id, brief, description }) => ({
		id,
		brief,
		description,
		category: "operator",
	}));
}

export function createMicrofrontendCatalog(): ChatCatalog {
	const entries = () => catalogEntries();
	let selectionAtTurn = activeSelection();

	return {
		turnContext: () => {
			const current = activeSelection();
			selectionAtTurn = current;
			if (!current) return undefined;
			return {
				activeSelection: {
					type: current.ref.type,
					selection: current.ref.selection,
				},
			};
		},
		catalog: {
			search: (query, limit) => searchOperatorCatalog(query, limit),
			listCategories: categories,
			meta: catalogEntry,
			invoke: (id, params) =>
				invokeCatalogEntry(id, params, "assistant", selectionAtTurn),
			load: async (id) => {
				const entry = catalogEntry(id);
				if (!entry?.targetType) return entry?.parameters;
				await loadObjectType(entry.targetType);
				const type = objectRegistry.type(entry.targetType);
				if (!type) {
					throw new Error(
						`[chat] Object type "${entry.targetType}" did not register after loading`,
					);
				}
				if (entry.operator !== "select" || !type.selection?.describe)
					return catalogEntry(id)?.parameters;
				// The descriptor is a live microservice capability. In development it
				// may change without a shell reload; production also benefits when a
				// service exposes tenant-specific fields or presets.
				const definition = await loadSelectionDescriptor(type, true);
				if (!definition) {
					throw new Error(
						`[chat] Selection descriptor for "${entry.targetType}" is unavailable`,
					);
				}
				if (definition.filters.length === 0 && !definition.presets?.length) {
					throw new Error(
						`[chat] Selection descriptor for "${entry.targetType}" has no filter fields or presets`,
					);
				}
				return selectCommandSchema(definition) as FunctionParameters;
			},
		},
		context: {
			// Hot is the vocabulary itself; the resolved candidates are what search
			// and the category listing are for.
			getHot: () => briefs(operatorCatalogEntries()),
			listCategories: categories,
			listByCategory: (category) =>
				briefs(category === "operator" ? entries() : []),
			search: (query, limit) => briefs(searchOperatorCatalog(query, limit)),
		},
		label,
		onChange: (republish) => {
			void microfrontendRegistered.watch(republish);
			void microfrontendDeclared.watch(republish);
			onOperationAuthorizationChanged(republish);
		},
		diagnostics: {
			all: entries,
			meta: catalogEntry,
			loaded: (id) => Boolean(catalogEntry(id)),
			listCategories: categories,
			listByCategory: (category) =>
				briefs(category === "operator" ? entries() : []),
			listUserVisible: () => briefs(entries()),
			search: (query) => briefs(searchOperatorCatalog(query)),
			invoke: (id, params) => invokeCatalogEntry(id, params, "user"),
		},
	};
}
