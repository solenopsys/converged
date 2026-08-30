import {
	catalogEntries,
	catalogEntry,
	invokeCatalogEntry,
	microfrontendDeclared,
	microfrontendRegistered,
	type OperatorCatalogEntry,
	onOperationAuthorizationChanged,
	operatorCatalogEntries,
	searchOperatorCatalog,
} from "front-core/object-runtime";
import type { ChatCatalog } from "./store";

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

	return {
		catalog: {
			search: (query, limit) => searchOperatorCatalog(query, limit),
			listCategories: categories,
			meta: catalogEntry,
			invoke: (id, params) => invokeCatalogEntry(id, params, "assistant"),
			load: async () => {},
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
